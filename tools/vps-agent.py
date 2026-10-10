#!/usr/bin/env python3
"""Omni managed origin. Local service health is NOT an Iranian-carrier test."""
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import subprocess as sp
import time
import urllib.request
import uuid

ROOT = Path(os.environ.get('OMNI_VPS_DIR', '/etc/omni-vps'))
XRAY = os.environ.get('OMNI_XRAY_BIN', '/usr/local/bin/omni-xray')
CFG = ROOT / 'config.json'
PROF = ROOT / 'profiles.json'


def read_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


def write_json(path, data):
    path = Path(path)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False))
    tmp.chmod(0o600)
    tmp.replace(path)


def command(args, timeout=120):
    r = sp.run(args, capture_output=True, text=True, timeout=timeout)
    if r.returncode:
        # Never return an Xray configuration or private key to the panel.
        detail = (r.stderr or r.stdout or 'command failed')[-900:]
        raise RuntimeError(Path(args[0]).name + ': ' + detail)
    return r.stdout


def hostname(value):
    value = str(value or '').strip().lower()
    if len(value) > 253 or not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}', value):
        raise ValueError('A valid owned domain is required, without https:// or a path')
    return value


def address(value):
    try:
        ip = ipaddress.ip_address(value)
        if not ip.is_global:
            raise ValueError('The CDN address must be public')
        return str(ip)
    except ValueError:
        return hostname(value)


def client_id(value):
    return str(uuid.UUID(str(value)))


def make_config(pl):
    kind = pl['kind']
    uid = client_id(pl.get('uuid'))
    port = int(pl.get('port', 443))
    if not 1 <= port <= 65535:
        raise ValueError('Invalid port')
    profile = {'kind': kind, 'uuid': uid, 'port': port}
    client = {'id': uid}
    inbound = {'listen': '0.0.0.0', 'port': port, 'protocol': 'vless',
               'settings': {'clients': [client], 'decryption': 'none'}}
    if kind == 'reality':
        sni = hostname(pl.get('sni'))
        output = command([XRAY, 'x25519'])
        fields = {k.strip().lower().replace(' ', ''): v.strip()
                  for k, v in (line.split(':', 1) for line in output.splitlines() if ':' in line)}
        private = fields.get('privatekey')
        public = fields.get('publickey') or fields.get('password') or fields.get('password(publickey)')
        if not private or not public:
            raise RuntimeError('Xray did not return the Reality key pair')
        sid = os.urandom(8).hex()
        profile.update({'sni': sni, 'pbk': public, 'sid': sid})
        client['flow'] = 'xtls-rprx-vision'
        inbound['streamSettings'] = {'network': 'tcp', 'security': 'reality', 'realitySettings': {
            'show': False, 'target': sni + ':443', 'serverNames': [sni], 'privateKey': private, 'shortIds': [sid]}}
    elif kind == 'ws':
        dom = hostname(pl.get('domain'))
        path = str(pl.get('path') or '/vzn')
        if not re.fullmatch(r'/[A-Za-z0-9/_-]{1,120}', path):
            raise ValueError('Invalid WebSocket path')
        via_cdn = bool(pl.get('via_cdn'))
        edge = address(pl.get('address') or dom)
        profile.update({'domain': dom, 'address': edge, 'path': path, 'via_cdn': via_cdn, 'port': 443})
        if pl.get('fake_sni') or pl.get('spoof_ip'):
            profile['fake_sni'] = hostname(pl.get('fake_sni'))
            ip = ipaddress.ip_address(str(pl.get('spoof_ip')))
            if not ip.is_global:
                raise ValueError('Spoof IP must be a public IP')
            profile['spoof_ip'] = str(ip)
        inbound['port'] = 443
        inbound['streamSettings'] = {'network': 'ws', 'security': 'tls',
            'wsSettings': {'path': path}, 'tlsSettings': {'alpn': ['http/1.1'], 'certificates': [{
                'certificateFile': '/etc/letsencrypt/live/' + dom + '/fullchain.pem',
                'keyFile': '/etc/letsencrypt/live/' + dom + '/privkey.pem'}]}}
    else:
        raise ValueError('Unsupported relay kind')
    # One active inbound per node in this version. Do not advertise overwritten ones.
    return {'log': {'loglevel': 'warning'}, 'inbounds': [inbound],
            'outbounds': [{'protocol': 'freedom', 'tag': 'direct'}]}, profile


def apply_config(cfg, profile):
    candidate = ROOT / 'config.candidate.json'
    write_json(candidate, cfg)
    try:
        command([XRAY, 'run', '-test', '-c', str(candidate)], 30)
        old = CFG.read_bytes() if CFG.exists() else None
        candidate.replace(CFG)
        try:
            command(['systemctl', 'enable', '--now', 'omni-xray'], 40)
            command(['systemctl', 'restart', 'omni-xray'], 40)
            time.sleep(1)
            command(['systemctl', 'is-active', '--quiet', 'omni-xray'], 10)
            with socket.create_connection(('127.0.0.1', int(profile['port'])), timeout=5):
                pass
        except Exception:
            if old is not None:
                CFG.write_bytes(old)
                CFG.chmod(0o600)
                sp.run(['systemctl', 'restart', 'omni-xray'], capture_output=True, timeout=30)
            else:
                CFG.unlink(missing_ok=True)
                sp.run(['systemctl', 'stop', 'omni-xray'], capture_output=True, timeout=30)
            raise
        write_json(PROF, [profile])
    finally:
        candidate.unlink(missing_ok=True)


def handle(pl):
    kind = pl.get('kind')
    if kind in ('ws', 'reality'):
        cfg, profile = make_config(pl)
        if kind == 'ws':
            # DNS/CDN provisioning is a prerequisite, not something faked by SNI.
            # ACME HTTP-01 must reach port 80 here (directly or via the CDN).
            command(['certbot', 'certonly', '--standalone', '--preferred-challenges', 'http',
                     '-d', profile['domain'], '--non-interactive', '--agree-tos',
                     '--register-unsafely-without-email', '--keep-until-expiring'], 240)
        apply_config(cfg, profile)
        return 'origin service active; Iranian line and CDN path NOT verified'
    if kind == 'restart':
        command(['systemctl', 'restart', 'omni-xray'], 40)
        time.sleep(1)
        command(['systemctl', 'is-active', '--quiet', 'omni-xray'], 10)
        return 'local service restarted; carrier connectivity not tested'
    if kind == 'uninstall':
        command(['systemctl', 'disable', '--now', 'omni-xray'], 40)
        write_json(PROF, [])
        return 'relay stopped; management agent remains installed'
    raise ValueError('Unsupported task')


def post(api, token, path, extra=None):
    body = {'token': token, **(extra or {})}
    req = urllib.request.Request(api + path, data=json.dumps(body).encode(),
                                 headers={'content-type': 'application/json', 'User-Agent': 'Omni-VPS-Agent/10.1'})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.load(response)
    if not data.get('ok'):
        raise RuntimeError('Panel rejected request')
    return data


def cycle(api, token):
    cache_path = ROOT / 'task-results.json'
    done = read_json(cache_path, {})
    data = post(api, token, '/api/vps/poll')
    for task in data.get('tasks', []):
        key = str(task['id'])
        if key not in done:
            try:
                done[key] = 'ok: ' + handle(task['payload'])
            except Exception as exc:
                done[key] = 'error: ' + str(exc)[-1200:]
            write_json(cache_path, done)
    active = sp.run(['systemctl', 'is-active', '--quiet', 'omni-xray'],
                    capture_output=True, timeout=10).returncode == 0
    profiles = read_json(PROF, []) if active else []
    post(api, token, '/api/vps/report', {
        'status': 'online' if active else 'agent_ready',
        'info': {'host': socket.gethostname(), 'agent_version': '10.1', 'xray_active': active,
                 'proof_scope': 'local-service-only'},
        'profiles': profiles, 'done': list(done), 'results': done})
    # Only forget results once the panel acknowledged them; failed reports retry.
    write_json(cache_path, {})


def main():
    conf = read_json(ROOT / 'agent.json', {})
    api, token = conf['api'], conf['token']
    while True:
        try:
            cycle(api, token)
        except Exception as exc:
            print('agent: ' + str(exc), flush=True)
        # Existing Xray keeps running even if the management panel is unreachable.
        time.sleep(45)


if __name__ == '__main__':
    main()
