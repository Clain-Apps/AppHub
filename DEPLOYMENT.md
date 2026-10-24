# Deployment

Pushing to `main` builds this application on GitHub Actions and publishes it to `/apps/allapps/` on the FlowVPS Ubuntu server. The running copy is switched only after the new release is on disk and answers a health check.

This application is not a static site. The workflow builds the Vite frontend to `frontend/dist`, then the Node.js backend serves that directory, the catalog API, and the WebSocket. Caddy is the public web server. Node listens on `127.0.0.1:3001` only.

Nothing in this repository changes the live server by itself. Complete the one-time setup below, then add the GitHub secrets, before the workflow can succeed.

## One-time VPS configuration

Run these commands as root from the FlowVPS console. The deployment account is `deploy`. Do not deploy as root.

Install Node.js 22 so the binaries exist at `/usr/bin/node` and `/usr/bin/npm` (the same major version the workflow uses), plus rsync:

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg rsync
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v
npm -v
```

`node -v` must print `v22`. If the NodeSource command fails, use the current Ubuntu instructions at <https://github.com/nodesource/distributions> and confirm both binaries are still on `/usr/bin`.

Install Caddy from its official repository: <https://caddyserver.com/docs/install#debian-ubuntu-raspberry-pi-os>. Then allow SSH, HTTP, and HTTPS only. Do not open port 3001.

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

Create the account if it does not exist:

```bash
adduser --disabled-password --gecos "" deploy
```

Install the systemd unit from `deploy/allapps.service` in this repository:

```bash
cp deploy/allapps.service /etc/systemd/system/allapps.service
systemctl daemon-reload
systemctl enable allapps
```

Do not start it yet. The first successful workflow creates `/apps/allapps/current` and starts the service.

Allow `deploy` to restart only this service:

```bash
printf '%s\n' 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart allapps, /usr/bin/systemctl stop allapps' > /etc/sudoers.d/allapps-deploy
chmod 440 /etc/sudoers.d/allapps-deploy
visudo -cf /etc/sudoers.d/allapps-deploy
```

Point DNS for the public domain at `195.114.14.111`. Caddy requests a certificate once that record resolves and ports 80 and 443 are open.

Copy `deploy/Caddyfile` to `/etc/caddy/Caddyfile`, replace `example.com`, and reload:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

## SSH key

On your own computer, create a key with no passphrase. GitHub Actions cannot unlock a passphrase.

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\apphub-deploy -C "github-actions-allapps"
```

On the server, as root, install the public key for `deploy` only:

```bash
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy /dev/null /home/deploy/.ssh/authorized_keys
nano /home/deploy/.ssh/authorized_keys
```

Paste the single line from `%USERPROFILE%\.ssh\apphub-deploy.pub`.

Confirm the private key can log in as `deploy`, not as root:

```powershell
ssh -i $env:USERPROFILE\.ssh\apphub-deploy deploy@195.114.14.111
```

## Directory ownership and permissions

Application code for this repository lives under `/apps/allapps/`. Other applications get their own directories next to it (`/apps/poolcomp/`, `/apps/journal/`). The catalog and the environment file stay outside `/apps`, so a Caddy `file_server` pointed at `/apps` cannot read them. Do not configure Caddy to serve `/apps` as files.

```bash
install -d -m 755 -o deploy -g deploy /apps
install -d -m 755 -o deploy -g deploy /apps/allapps
install -d -m 755 -o deploy -g deploy /apps/allapps/releases
install -d -m 750 -o deploy -g deploy /var/lib/allapps
install -d -m 750 -o deploy -g deploy /var/lib/allapps/catalog
install -d -m 750 -o root -g deploy /etc/allapps
install -m 640 -o root -g deploy /dev/null /etc/allapps/environment
```

Copy `deploy/environment.example` to `/etc/allapps/environment` and replace `example.com`. `PUBLIC_PATH_PREFIX` must stay `/allapps`, because the workflow builds the frontend with that prefix. `BACKEND_PORT` must stay `3001`.

Each directory under `/apps` should be owned by `deploy` (or at least traversable by `deploy`) so App Hub can list the folders. A deploy of `allapps` only writes inside `/apps/allapps/`.

## GitHub secrets

In the repository settings (or with the GitHub CLI), create these secrets. Do not commit the private key or the host key.

| Secret | Value |
| --- | --- |
| `FLOWVPS_HOST` | `195.114.14.111` |
| `FLOWVPS_SSH_KEY` | Contents of the private key file `apphub-deploy` |
| `FLOWVPS_KNOWN_HOSTS` | One verified `known_hosts` line for that address |

Verify the host key before storing it. On the server console:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

On your computer:

```powershell
ssh-keyscan -t ed25519 195.114.14.111 | ssh-keygen -lf -
```

The fingerprints must match. Only then store the keyscan line:

```powershell
gh secret set FLOWVPS_HOST --body "195.114.14.111"
Get-Content -Raw $env:USERPROFILE\.ssh\apphub-deploy | gh secret set FLOWVPS_SSH_KEY
ssh-keyscan -t ed25519 195.114.14.111 | gh secret set FLOWVPS_KNOWN_HOSTS
```

The workflow rejects the connection when this line does not match the server. It does not call `ssh-keyscan` itself.

## What a deployment does

1. A push to `main`, or a manual run from the Actions tab (`workflow_dispatch`), starts one Ubuntu runner.
2. The runner installs dependencies with `npm ci`, runs `npm run check` (lint, typecheck, and tests), and builds the frontend with `PUBLIC_PATH_PREFIX=/allapps`.
3. Development dependencies are removed. The staged directory contains `package.json`, `package-lock.json`, production `node_modules`, `shared`, `backend`, and `frontend/dist`. It does not contain `.git`, `.env`, or test files.
4. `rsync` uploads that directory to `/apps/allapps/releases/<commit>-<run>-<attempt>/`. A failed upload deletes that new directory and leaves `/apps/allapps/current` unchanged.
5. `deploy/activate-release.sh` points the `current` symlink at the new directory, runs `systemctl restart allapps`, and requests `http://127.0.0.1:3001/api/health`. If the restart or the health check fails, the symlink returns to the previous release and that release is started again.
6. After a healthy switch, releases older than the three newest are deleted. The live release is never deleted. Other directories under `/apps` are never deleted.

A second deploy waits until the first finishes (`concurrency` group `deploy-allapps`).

## Adapt the workflow for another repository

Copy `.github/workflows/deploy.yml` and `deploy/activate-release.sh`. Change the values at the top of the workflow, and change the concurrency group to `deploy-<APP_NAME>`:

- `APP_NAME: poolcomp` publishes to `/apps/poolcomp/`.
- `BUILD_OUTPUT` is the directory the build writes. This repository uses `frontend/dist`.
- `SERVICE_NAME` is the systemd unit. This repository uses `allapps` because a Node process must keep running.
- `BACKEND_PORT` must match that application's `/etc/<APP_NAME>/environment` and its Caddy `reverse_proxy` port.

Give that application its own Linux account permissions, unit file, environment file under `/etc/<APP_NAME>/`, and data directory under `/var/lib/<APP_NAME>/`. Do not point two workflows at the same `APP_NAME`.

For a static site, stop after copying `BUILD_OUTPUT` into the release, omit the Node service, and set Caddy `root` to `/apps/<APP_NAME>/current` with `file_server` and `try_files {path} /index.html`. Do not put secrets in that directory.

## Caddy

`deploy/Caddyfile` routes `https://example.com/allapps/` to `127.0.0.1:3001` without publishing the Node port. The frontend is built so asset, API, catalog-image, and WebSocket URLs start with `/allapps/`. Refreshing any URL under that prefix returns the application shell.

The backend also accepts the same paths with the prefix removed, so a later `handle_path` rule still works. Use one style. The checked-in file does not strip the prefix.

Tiles for other folders still open `https://<folder>.<PUBLIC_APPLICATION_HOST>`. Path routing for those sites is a separate Caddy block and a separate DNS name until that link format is changed. Add one `handle` block and one loopback port per application. Do not give two applications the same port.

## Verify the app is live

On the server:

```bash
systemctl status allapps
journalctl -u allapps -n 50 --no-pager
curl -fsS http://127.0.0.1:3001/api/health
readlink -f /apps/allapps/current
```

The health response is `{"status":"ok"}`. From a browser, open `https://<your-domain>/allapps/`. The grid lists each directory in `/apps`.

## Troubleshooting

**`Set the FLOWVPS_HOST secret` (or another secret).** The secret is missing or empty. Add it, then re-run the workflow. A failed run does not change `current`.

**`Host key verification failed`.** `FLOWVPS_KNOWN_HOSTS` does not match this server. Repeat the fingerprint comparison and replace the secret. Do not turn off strict host-key checking.

**`Permission denied (publickey)`.** The public key is not in `/home/deploy/.ssh/authorized_keys`, the file is not mode `600`, or `.ssh` is not mode `700` and owned by `deploy`.

**`sudo: a password is required`.** `/etc/sudoers.d/allapps-deploy` is missing, or `visudo -cf` reported an error. The unit name in that file must be `allapps`.

**Health check failed, previous release restored.** Read `journalctl -u allapps`. Typical causes are Node not being on `/usr/bin/node`, `/etc/allapps/environment` missing a variable, or port 3001 already taken. `readlink -f /apps/allapps/current` shows the restored directory.

**Caddy returns 502.** The service is not healthy on `127.0.0.1:3001`, or the Caddy block proxies a different port. `ss -ltnp | grep 3001` should show Node on `127.0.0.1` only.

**The page loads without styles or the socket never connects.** The browser is not using the `/allapps/` prefix, or `PUBLIC_PATH_PREFIX` in `/etc/allapps/environment` is not `/allapps`. Rebuilds take the prefix from `APP_NAME` in the workflow.

**Uploads or catalog edits return 403.** `ALLOWED_ORIGINS` must be the site origin, for example `https://example.com`, with no path.

**`rsync` exits with code 23 or `Permission denied`.** `/apps/allapps/releases` is missing or not writable by `deploy`.

**A release directory is left behind after a failed upload.** It is an unused directory under `/apps/allapps/releases/` and is not the `current` symlink. Deleting that one directory is safe. Do not delete `/apps` or another application's directory.
