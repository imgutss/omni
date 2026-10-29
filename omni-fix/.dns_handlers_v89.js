        } else if (i === "omni-dns-select") {
          await b.saveSettings({ dns_upstream: s.dataset.url });
          e.setSettings({ ...e.settings(), dns_upstream: s.dataset.url });
          y(n("dns.saved"), "ok");
          e.rerenderView("dns");
        } else if (i === "omni-dns-wtest") {
          await dnsRunWorkerOne(e, s.dataset.id);
        } else if (i === "omni-dns-dtest") {
          await dnsRunDeviceOne(e, s.dataset.id);
        } else if (i === "omni-dns-wall") {
          await dnsRunWorkerAll(e);
        } else if (i === "omni-dns-dall") {
          await dnsRunDeviceAll(e);
        } else if (i === "omni-dns-region") {
          DNS_UI.region = s.dataset.v || "all"; dnsSave(); e.rerenderView("dns");
        } else if (i === "omni-dns-sort") {
          DNS_UI.sort = s.dataset.v || "default"; dnsSave(); e.rerenderView("dns");
