# Discord Jira Bot 🤖

[![Build Status](https://github.com/duartejbrito/discord-jira/actions/workflows/rollup.yml/badge.svg)](https://github.com/duartejbrito/discord-jira/actions/workflows/rollup.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/syter/discord-jira)](https://hub.docker.com/r/syter/discord-jira)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-22.17.1+-green.svg)](https://nodejs.org/)

A powerful Discord bot that integrates with Jira to help you track and log work time directly from Discord. Built with TypeScript and Discord.js, this bot enables seamless time tracking and work logging functionality.

## ✨ Features

- **🔧 Easy Setup**: Configure your Jira instance with simple slash commands
- **⏰ Time Tracking**: View your work from previous days and log time to multiple issues
- **🕒 Automated Logging**: Schedule automatic time logging for consistent daily tracking
- **📊 Work Overview**: Get detailed views of your recent work and time logs
- **🔄 Flexible Distribution**: Automatically distribute hours across multiple issues worked on
- **⏸️ Pause/Resume**: Control when automatic logging should run
- **🔒 Secure**: Individual user configurations with encrypted API tokens
- **🧪 Well Tested**: Comprehensive test suite with coverage reporting
- **🐳 Docker Ready**: Containerized deployment with multi-registry support
- **📈 Monitoring**: Built-in logging and error tracking capabilities

### 🛡️ Enterprise-Grade Security & Reliability

- **🔐 Input Validation**: Comprehensive sanitization and validation of all user inputs
- **🔑 Data Encryption**: AES-256-GCM encryption for sensitive data (API tokens, passwords)
- **⚡ Rate Limiting**: Per-user, per-action rate limiting to prevent abuse
- **🚫 XSS Protection**: Built-in protection against cross-site scripting attacks
- **🛠️ Error Handling**: Robust error handling with user-friendly messages and retry mechanisms
- **📊 Health Monitoring**: System health checks for database, Discord, and memory usage
- **📝 Audit Logging**: Detailed logging with unique error IDs for troubleshooting
- **🔄 Circuit Breaker**: Automatic failure detection and recovery for external services

## 🚀 Commands

| Command   | Description                       | Usage                                                                         |
| --------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `/setup`  | Configure your Jira connection    | Set up host, username, token, JQL query, and daily hours                      |
| `/time`   | View work and log time manually   | Check work from X days ago and optionally log hours                           |
| `/hours`  | Configure daily hours for logging | Set number of hours to distribute across tickets daily                        |
| `/pause`  | Pause/resume automatic logging    | Toggle scheduled time logging on/off                                          |
| `/info`   | View your current configuration   | Display your Jira setup and settings                                          |
| `/health` | Check system health status        | View detailed system health including database, Discord, memory, and services |
| `/ping`   | Check if the bot is responsive    | Simple health check command                                                   |

## 📋 Prerequisites

- Node.js 22.17.1+ (recommended)
- PostgreSQL database
- Discord Bot Token
- Jira API access (username + API token)

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/duartejbrito/discord-jira.git
cd discord-jira
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
OWNER_GUILD_ID=your_guild_id_for_owner_commands
OWNER_ID=your_discord_user_id
OWNER_LOG_CHANNEL_ID=channel_id_for_logs

# Logging Configuration
DISCORD_LOGGING=true
PG_LOGGING=false

# Database Configuration
PG_CONNECTION_STRING=postgresql://username:password@host:port/database
```

### 4. Database Setup

The bot uses PostgreSQL with Sequelize ORM. The database models will be automatically initialized when the bot starts.

### 5. Build and Run

#### Development

```bash
npm run dev
```

#### Production

```bash
npm run build
npm start
```

#### Docker

**Using pre-built images:**

```bash
# From GitHub Container Registry
docker pull ghcr.io/duartejbrito/discord-jira:latest
docker run -d --env-file .env ghcr.io/duartejbrito/discord-jira:latest

# From Docker Hub
docker pull syter/discord-jira:latest
docker run -d --env-file .env syter/discord-jira:latest

# Using Docker Compose (recommended)
npm run dev-docker
```

**Building locally:**

```bash
# Build and run with Docker Compose
npm run dev-docker

# Or manually with Docker
docker build -t discord-jira .
docker run --env-file .env discord-jira
```

## 🔧 Configuration

### Discord Bot Setup

1. Create a new application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a bot and copy the token
3. Add the bot to your server with appropriate permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links

### Jira API Setup

1. Generate an API token from your [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Use the `/setup` command in Discord to configure your connection
3. Optionally provide a JQL query to filter which issues appear in your time tracking

## 📅 Automated Scheduling

The bot includes an automated scheduler that:

- Runs Monday through Friday at 6:00 AM UTC
- Automatically logs your configured daily hours to issues you worked on the previous day
- Distributes time proportionally across multiple issues
- Can be paused/resumed per user with the `/pause` command
- Daily hours can be configured per user (defaults to 8 hours)

### Daily Hours Configuration

Each user can configure their daily hours independently:

- Use `/hours <number>` to set your daily hours (1-24)
- Use `/setup` with the `daily-hours` parameter during initial configuration
- The `/time` command uses your configured hours when hours are not explicitly specified
- The scheduler automatically uses your configured hours for daily time logging

Schedule configuration can be modified in `src/scheduler/index.ts`:

```typescript
export const dailyRule = "0 6 * * 2-6"; // Cron format
// Daily hours are now configured per user in the database
```

## 🏗️ Project Structure

```
src/
├── commands/         # Discord slash commands
├── config.ts         # Environment configuration
├── db/               # Database models and setup
├── jira/             # Jira API integration
├── scheduler/        # Automated time logging
├── services/         # Core business logic services
├── types/            # TypeScript type definitions
└── utils/            # Utility functions and logging
tests/
├── commands/         # Command tests
├── db/               # Database tests
├── services/         # Service tests
├── __mocks__/        # Test mocks
└── setup.ts          # Test configuration
```

## 🚀 CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

- **🔄 Automated Testing**: Runs on every push and pull request
- **📊 Coverage Reports**: Generates detailed test coverage reports
- **🐳 Docker Build**: Automatically builds and pushes Docker images
- **📦 Multi-Registry**: Publishes to both GitHub Container Registry and Docker Hub
- **🔍 Code Quality**: Automated linting and formatting checks

### Docker Images

The bot is available as Docker images:

- `ghcr.io/duartejbrito/discord-jira:latest` (GitHub Container Registry)
- `syter/discord-jira:latest` (Docker Hub)

## 🔄 Development Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:ci      # Run tests with coverage for CI/CD
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run dev-docker   # Build and run with Docker Compose
```

## 🧪 Testing & Coverage

This project includes comprehensive testing with Jest:

- **Unit Tests**: Testing individual components and services
- **Integration Tests**: Testing database interactions and external APIs
- **Coverage Reports**: Automated coverage reporting with HTML output
- **CI/CD Integration**: Tests run automatically on every push and pull request

Run tests locally:

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode for development
npm run test:ci       # Run tests with coverage report
```

Coverage reports are generated in the `coverage/` directory and include detailed HTML reports for easy review.

## 💡 Usage Examples

### Initial Setup

```bash
# Set up your Jira connection with custom daily hours
/setup host:your-instance.atlassian.net username:your-email@company.com token:your-api-token daily-hours:6

# Or set up with defaults (8 hours)
/setup host:your-instance.atlassian.net username:your-email@company.com token:your-api-token
```

### Daily Hours Configuration

```bash
# Configure your daily hours to 6 hours
/hours 6

# Configure for part-time work (4 hours)
/hours 4

# Standard full-time (8 hours)
/hours 8
```

### Time Tracking

```bash
# Check your work from yesterday and log time using your configured daily hours
/time days-ago:1

# Check work from 2 days ago and explicitly log 6 hours
/time days-ago:2 hours:6

# The scheduler will automatically use your configured daily hours
```

### Configuration Management

```bash
# View your current configuration including daily hours
/info

# Pause automatic logging
/pause

# Resume automatic logging
/pause
```

## 🤝 Contributing

We welcome contributions! This project follows best practices for code quality and testing.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Run linting and formatting (`npm run lint && npm run format`)
6. Commit your changes (`git commit -m 'Add some amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Quality Standards

- **Testing**: All new features should include comprehensive tests
- **Coverage**: Maintain high test coverage (aim for >80%)
- **Linting**: Code must pass ESLint checks
- **Formatting**: Use Prettier for consistent code formatting
- **TypeScript**: Maintain strict typing throughout the codebase

### Before Submitting

```bash
npm test              # Ensure all tests pass
npm run lint          # Check for linting issues
npm run format        # Format code consistently
npm run build         # Verify the build works
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Duarte 'SyTeR' Brito**

- Email: sytertzp@gmail.com
- GitHub: [@duartejbrito](https://github.com/duartejbrito)

## 🐛 Issues & Support

If you encounter any issues or need support, please [open an issue](https://github.com/duartejbrito/discord-jira/issues) on GitHub.

---

_Made with ❤️ for better Jira time tracking workflows_
