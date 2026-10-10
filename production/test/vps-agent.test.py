"""Unit tests only: no VPS or certificate is installed by this test."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock

source = Path(__file__).resolve().parents[2] / 'tools/vps-agent.py'
spec = importlib.util.spec_from_file_location('omni_agent', source)
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
UID='11111111-1111-4111-8111-111111111111'
WS={'kind':'ws','uuid':UID,'domain':'relay.example.com','via_cdn':True,'address':'snapp.ir','path':'/vzn', 'fake_sni':'snapp.ir','spoof_ip':'1.1.1.1'}

class Tests(unittest.TestCase):
    def test_cdn_keeps_real_domain_and_tls(self):
        cfg, p=a.make_config(WS)
        self.assertEqual(p['domain'],'relay.example.com')
        self.assertEqual(p['address'],'snapp.ir')
        self.assertEqual(p['fake_sni'],'snapp.ir')
        self.assertEqual(cfg['inbounds'][0]['streamSettings']['security'],'tls')
        self.assertEqual(len(cfg['inbounds']),1)
        self.assertNotIn('snapp.ir',json.dumps(cfg),'fake SNI belongs to client, not origin TLS')
        self.assertIn('/relay.example.com/',json.dumps(cfg))
    def test_certificate_failure_never_publishes_profile(self):
        with patch.object(a,'command',side_effect=RuntimeError('certificate failed')), patch.object(a,'apply_config') as apply:
            with self.assertRaises(RuntimeError): a.handle(WS)
            apply.assert_not_called()
    def test_modern_and_legacy_x25519_output(self):
        for label in ('Public key','Password','Password (PublicKey)'):
            with patch.object(a,'command',return_value='Private key: secret\n'+label+': public\n'):
                cfg,p=a.make_config({'kind':'reality','uuid':UID,'sni':'www.example.com'})
            self.assertEqual(p['pbk'],'public')
            self.assertNotIn('secret',json.dumps(p))
            self.assertEqual(cfg['inbounds'][0]['streamSettings']['realitySettings']['target'],'www.example.com:443')
    def test_bad_input(self):
        for pl in ({**WS,'uuid':'bad'},{**WS,'domain':'x.com;id'},{**WS,'path':'/x?ed=2048'},
                   {**WS,'spoof_ip':'127.0.0.1'},{'kind':'reality','uuid':UID}):
            with self.assertRaises(ValueError): a.make_config(pl)
    def test_apply_rolls_back_and_keeps_old_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);cfg=root/'config.json';prof=root/'profiles.json'
            cfg.write_text('{"old":true}');prof.write_text('[{"old":true}]')
            def run(args, *rest):
                if 'restart' in args: raise RuntimeError('start failed')
                return ''
            with patch.object(a,'ROOT',root),patch.object(a,'CFG',cfg),patch.object(a,'PROF',prof),patch.object(a,'command',side_effect=run),patch.object(a.sp,'run'):
                with self.assertRaises(RuntimeError): a.apply_config({'new':True},{'port':443})
            self.assertEqual(json.loads(cfg.read_text()),{'old':True})
            self.assertEqual(json.loads(prof.read_text()),[{'old':True}])
    def test_agent_identifies_itself_instead_of_blocked_python_default(self):
        response=Mock()
        response.__enter__=Mock(return_value=response)
        response.__exit__=Mock(return_value=False)
        response.read=Mock(return_value=b'{"ok":true}')
        with patch.object(a.urllib.request,'urlopen',return_value=response) as open_url:
            a.post('https://panel.example.com','test-only','/api/vps/poll')
        request=open_url.call_args.args[0]
        headers={k.lower():v for k,v in request.header_items()}
        self.assertEqual(headers['user-agent'],'Omni-VPS-Agent/10.1')
    def test_inactive_xray_never_reports_online(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);prof=root/'profiles.json';prof.write_text('[{"kind":"ws"}]')
            post=Mock(side_effect=[{'ok':True,'tasks':[]},{'ok':True}])
            with patch.object(a,'ROOT',root),patch.object(a,'PROF',prof),patch.object(a,'post',post),patch.object(a.sp,'run',return_value=Mock(returncode=1)):
                a.cycle('https://panel.example.com','not-a-real-token')
            report=post.call_args_list[-1].args[3]
            self.assertEqual(report['status'],'agent_ready')
            self.assertEqual(report['profiles'],[])
            self.assertEqual(report['info']['proof_scope'],'local-service-only')
    def test_unacknowledged_task_results_retry_without_reinstallation(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            task={'id':9,'payload':WS}
            post=Mock(side_effect=[{'ok':True,'tasks':[task]},RuntimeError('report unavailable')])
            with patch.object(a,'ROOT',root),patch.object(a,'post',post),patch.object(a,'handle',return_value='ok') as handle,patch.object(a.sp,'run',return_value=Mock(returncode=0)):
                with self.assertRaises(RuntimeError): a.cycle('https://panel.example.com','test')
                self.assertIn('9',json.loads((root/'task-results.json').read_text()))
                post.side_effect=[{'ok':True,'tasks':[task]},{'ok':True}]
                a.cycle('https://panel.example.com','test')
                self.assertEqual(handle.call_count,1)
                self.assertEqual(json.loads((root/'task-results.json').read_text()),{})

if __name__=='__main__': unittest.main()
