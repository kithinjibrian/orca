<h1 align="center">Pod</h1>
<p align="center">
<img src="https://i.postimg.cc/Wpq8CWvV/orca.png" alt="pod-logo" width="150px"/>
<br>
<em>The CLI tool for Orca that handles everything from scaffolding to deployment.</em>
<br>
</p>
<p align="center">
<a href="https://orca.dafifi.net/"><strong>orca.dafifi.net</strong></a>
<br>
</p>
<p align="center">
<a href="https://www.npmjs.com/package/@kithinji/pod">
<img src="https://img.shields.io/badge/NPM_package-v1.0.21-blue" alt="Pod on npm" />
</a>
</p>

<p align="center">
<a href="https://github.com/kithinjibrian/orca">
<img src="https://img.shields.io/badge/Orca framework-blue" alt="Orca on github" />
</a>
</p>

<hr>

## What is Pod?

Pod is the official CLI tool for Orca. It's your command center for creating, developing, and deploying Orca applications.

Unlike most framework CLIs that stop at scaffolding, Pod follows you through the entire development lifecycle:

- **Create** new Orca projects with best-practice structure
- **Generate** components, services, and modules instantly
- **Develop** with a fast, integrated development server
- **Dockerize** your application with zero configuration
- **Deploy** to cloud platforms like AWS EC2 with built-in automation

Pod is designed with one philosophy: **never abandon the developer**. From `pod new` to production deployment, Pod is there every step of the way.

## Installation

Install Pod globally via npm:

```bash
npm install -g @kithinji/pod
```

Verify installation:

```bash
pod --version
# Output: 1.0.21
```

## Commands

### `pod new <name>`

Create a new Orca project with a complete starter template.

```bash
pod new my-app
```

**What it does:**

1. Scaffolds a complete Orca project structure
2. Installs all dependencies automatically
3. Starts the development server immediately

**Output structure:**

```
my-app/
├── src/
│   │   └── app/
│   │       ├── app.module.ts
│   │       ├── app.service.ts
│   │       └── app.page.tsx
│   └── main.ts
├── package.json
├── tsconfig.json
└── pod.config.tx
```

After running this command, your app is live at `http://localhost:8080` and ready for development.

---

### `pod dev`

Start the Orca development server with hot reload.

```bash
pod dev
```

**Features:**

- Hot module replacement for instant feedback
- Automatic TypeScript compilation
- Watches for file changes across the entire project
- Compiles separate client and server bundles
- Serves the application locally

**Development workflow:**

1. Make changes to any file (components, services, modules)
2. Pod detects the change and recompiles
3. Browser automatically refreshes with your changes
4. Check the terminal for any compilation errors

Run this command from your project root whenever you're ready to develop.

---

### `pod add <type> <name>`

Generate new code scaffolding instantly.

**Add a component:**

```bash
pod add c button
```

Creates `button.component.tsx`. This is inspired by `Shadcn/ui` where you components live inside your code instead of being hidden behind libraries.

**Add a feature module:**

```bash
pod add f user
```

Creates a complete feature module with:

```
src/features/user/
├── user.module.ts          # Module definition
├── user.service.ts         # Business logic service
└── user.page.tsx           # UI page component
```

**Generated files include:**

- Proper imports and decorators
- Dependency injection setup
- Module exports configuration
- Component/service boilerplate

**Types:**

- `c` - Component: Creates a single component file
- `f` - Feature: Creates a complete module with service and component

This command saves you from writing repetitive boilerplate and ensures consistency across your codebase.

---

### `pod dockerize <env>`

Generate Docker configuration for your Orca application.

```bash
pod dockerize production
```

**What it generates:**

1. `Dockerfile` - Optimized multi-stage build configuration
2. `.dockerignore` - Excludes unnecessary files from the image
3. `docker-compose.yml` - Will read package.json to determine which services to generate.

**The generated Dockerfile:**

- Uses multi-stage builds for smaller images
- Installs only production dependencies
- Optimizes layer caching for faster builds
- Sets up proper Node.js environment
- Configures the application to run in production mode

**After generation:**

```bash
# Run the container
docker compose up --build
```

**Environment-specific configs:**

The `<env>` parameter can be used to generate environment-specific Docker configurations (e.g., `development`, `production`). Pod will adjust settings like:

- Environment variables
- Build optimization levels
- Included dev dependencies
- Exposed ports
- Tunnel database connections through ssh if in development

---

### `pod deploy <target> [options]`

Deploy your Orca application to cloud platforms.

```bash
pod deploy ec2
```

**Supported targets:**

- `ec2` - AWS EC2 instances
- More platforms coming soon (Heroku, DigitalOcean, etc.)

**What it does:**

1. Reads deployment configuration from `pod.deploy.yml`
2. Builds your application for production
3. Creates necessary cloud resources (if needed)
4. Uploads your application to the target
5. Starts the application

**Options:**

`--force-install` - Force reinstallation of dependencies even if already present on the target

```bash
pod deploy ec2 --force-install
```

**Configuration file (`pod.deploy.yml`):**

```yml
name: my-app
version: 1.0.0

vars:
  deploy_path: &deploy_path "/home/ubuntu/app"
  backup_path: &backup_path "/home/ubuntu/backups"

shared_operations:
  install_docker: &install_docker
    type: ensure
    ensure:
      docker:
        version: "28.5.2"
        addUserToGroup: true

  stop_containers: &stop_containers
    type: action
    action:
      command: docker compose down --remove-orphans 2>/dev/null || true

  pull_images: &pull_images
    type: action
    action:
      command: docker compose pull --quiet

  build_and_start: &build_and_start
    type: action
    action:
      command: docker compose up -d --build --remove-orphans --wait

  cleanup_docker: &cleanup_docker
    type: action
    action:
      command: docker system prune -f --volumes --filter "until=168h"

targets:
  localhost:
    type: local
    operations:
      #- name: "Environment Setup"
      #  <<: *install_docker
      - name: "Refresh Stack"
        <<: *build_and_start

  ec2:
    type: ssh
    host: ec2-xx-xx-xxx-xxx.xx-xxxx-x.compute.amazonaws.com
    user: ubuntu
    keyPath: ~/xxxx.pem
    port: 22
    deployPath: *deploy_path

    operations:
      - name: "Provision Directories and Swap"
        type: ensure
        ensure:
          swap:
            size: 4G

      - name: "Install Docker"
        <<: *install_docker

      - name: "Sync Source Files"
        type: action
        action:
          rsync:
            source: ./
            destination: *deploy_path
            delete: true
            exclude:
              - .git/
              - node_modules/
              - .env.local
              - "*.log"

      - name: "Navigate to Deploy Path"
        type: action
        action:
          command: cd *deploy_path

      - name: "Create Pre-deployment Backup"
        type: action
        action:
          command: tar -czf *backup_path/backup-$(date +%Y%m%d-%H%M%S).tar.gz .

      - name: "Pull Latest Images"
        <<: *pull_images

      - name: "Stop Existing Stack"
        <<: *stop_containers

      - name: "Build and Launch"
        <<: *build_and_start

      - name: "Verify Health Status"
        type: verify
        verify:
          command: ! "[ $(docker compose ps --format json | grep -qv 'running\\|healthy') ]"

      - name: "Maintenance: Cleanup"
        type: action
        action:
          command: |
            find *backup_path -name "backup-*.tar.gz" -mtime +7 -delete
            docker image prune -af --filter "until=24h"
```

**First-time setup:**

Pod will guide you through setting up deployment credentials and configuration the first time you run `pod deploy`. It will:

- Prompt for necessary credentials (AWS keys, etc.)
- Validate your configuration
- Save settings to `pod.deploy.yml`
- Optionally create required cloud resources

**Deployment workflow:**

```bash
pod deploy ec2

# Pod handles the rest:
#    ✓ Building production bundle
#    ✓ Uploading to EC2
#    ✓ Installing dependencies
#    ✓ Starting the server
#    ✓ Configuring environment
```

---

## Workflow Example

Here's a complete workflow from project creation to deployment:

```bash
# 1. Create a new Orca app
pod new my-app
# (Pod automatically installs deps and starts dev server)

# 2. Add a new feature
pod add f product

# 3. Develop your app
# (Make changes, Pod hot-reloads automatically)

# 4. When ready to deploy, dockerize it
pod dockerize prod

# 5. Deploy to EC2
pod deploy ec2

# Done! Your app is live.
```

## Why Pod?

Most framework CLIs give you `create-app` and then disappear. Pod stays with you through the entire lifecycle:

**From idea to production:**

- `pod new` - Start building
- `pod add` - Generate code as you grow
- `pod dev` - Develop with instant feedback
- `pod dockerize` - Containerize for deployment
- `pod deploy` - Ship to production

**One tool. End to end. No gaps.**

That's the Pod philosophy.

---

## Comparison with Other CLIs

| Feature                 | Pod | Create-React-App | Angular CLI | Next.js CLI |
| ----------------------- | --- | ---------------- | ----------- | ----------- |
| Project scaffolding     | ✅  | ✅               | ✅          | ✅          |
| Component generation    | ✅  | ❌               | ✅          | ❌          |
| Service generation      | ✅  | ❌               | ✅          | ❌          |
| Module generation       | ✅  | ❌               | ✅          | ❌          |
| Dev server              | ✅  | ✅               | ✅          | ✅          |
| Built-in Docker support | ✅  | ❌               | ❌          | ❌          |
| One-command deployment  | ✅  | ❌               | ❌          | ❌          |
| Full-stack architecture | ✅  | ❌               | ❌          | Partial     |

Pod doesn't just scaffold; it's your development companion from first line to first user.

---

## Contributing

Pod is open source and welcomes contributions. Areas where we need help:

- Additional deployment targets (Heroku, DigitalOcean, Azure, etc.)
- Template customization
- Plugin development
- Documentation improvements

Check out the [contribution guidelines](https://github.com/kithinji/pod/CONTRIBUTING.md) to get started.

---

## Stay in Touch

- **Author**: [Kithinji Brian](https://www.linkedin.com/in/kithinjibrian/)
- **Website**: [orca.dafifi.net](https://orca.dafifi.net/)
- **NPM**: [@kithinji/pod](https://www.npmjs.com/package/@kithinji/pod)
- **GitHub**: [github.com/kithinji/pod](https://github.com/kithinji/pod)

---

## License

MIT

---

<p align="center">
<strong>Pod: The CLI that never abandons you.</strong>
</p>
