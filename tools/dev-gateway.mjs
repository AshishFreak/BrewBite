// Development only: serves every app on one origin (http://localhost:4200/<app>/) so they share
// browser storage and BroadcastChannel, which the dummy data layer uses for live updates.
// Production apps talk to the .NET API + SignalR instead and do not need this.
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PORT ?? 4200);
const HOST = process.env.HOST ?? 'localhost';
const APPS = {
  guest: { port: 4201, label: 'Guest QR ordering', hint: 'Phone · open a table' },
  pos: { port: 4202, label: 'POS & billing', hint: 'Tablet' },
  kitchen: { port: 4203, label: 'Kitchen display', hint: 'Kitchen screen' },
  owner: { port: 4204, label: 'Owner dashboard', hint: 'Phone' },
  admin: { port: 4205, label: 'Admin', hint: 'Menu, tables & QR' },
};

const appFor = url => {
  const name = (url ?? '/').split('/')[1];
  return APPS[name] ? { name, ...APPS[name] } : null;
};

const landing = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>RestaurantOS · dev</title><style>
body{font-family:system-ui,sans-serif;background:#f6f4f1;color:#1c1917;margin:0;padding:2rem 1rem}
main{max-width:720px;margin:0 auto}h1{margin:0 0 .3rem}p{color:#6b6560}
ul{list-style:none;padding:0;display:grid;gap:.7rem}a{display:block;padding:1rem;border-radius:14px;background:#fff;border:1px solid #e7e2dc;color:inherit;text-decoration:none}
a:hover{border-color:#ea580c}strong{display:block}small{color:#6b6560}</style></head><body><main>
<h1>RestaurantOS</h1><p>Development gateway. Open apps in separate windows; they update each other live using dummy data.</p><p>Staff apps ask you to sign in. Demo accounts: <b>owner</b>, <b>admin</b>, <b>manager</b>, <b>cashier</b>, <b>waiter</b>, <b>kitchen</b>, password <b>demo123</b>. Guests need no login.</p><ul>
${Object.entries(APPS).map(([name, a]) => `<li><a href="/${name}/"><strong>${a.label}</strong><small>/${name}/ · ${a.hint}</small></a></li>`).join('')}
</ul></main></body></html>`;

const server = http.createServer((req, res) => {
  const app = appFor(req.url);
  if (!app) {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(landing);
    } else {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found. Apps live under /guest/, /pos/, /kitchen/, /owner/ and /admin/.');
    }
    return;
  }
  const upstream = http.request(
    { host: 'localhost', port: app.port, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${app.port}` } },
    up => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(503, { 'content-type': 'text/plain', 'retry-after': '2' });
    res.end(`The ${app.name} dev server is still starting. Refresh in a few seconds.`);
  });
  req.pipe(upstream);
});

// Forward WebSocket upgrades (Vite live reload) to the matching app.
server.on('upgrade', (req, socket, head) => {
  const app = appFor(req.url);
  if (!app) return socket.destroy();
  const upstream = net.connect(app.port, 'localhost', () => {
    const headers = { ...req.headers, host: `localhost:${app.port}` };
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT, HOST, () => console.log(`\n  RestaurantOS dev gateway → http://${HOST}:${PORT}/\n`));

if (!process.argv.includes('--gateway-only')) {
  const serve = spawn('npx', ['nx', 'run-many', '-t', 'serve', '--parallel=5', '--outputStyle=stream'], { stdio: 'inherit', shell: true });
  const stop = () => {
    serve.kill();
    process.exit();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  serve.on('exit', code => process.exit(code ?? 0));
}
