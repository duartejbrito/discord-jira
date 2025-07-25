# Discord Jira Bot 🤖

A powerful Discord bot that integrates with Jira to help you track and log work time directly from Discord. Built with TypeScript and Discord.js, this bot enables seamless time tracking and work logging functionality.

## ✨ Features

- **🔧 Easy Setup**: Configure your Jira instance with simple slash commands
- **⏰ Time Tracking**: View your work from previous days and log time to multiple issues
- **🕒 Automated Logging**: Schedule automatic time logging for consistent daily tracking
- **📊 Work Overview**: Get detailed views of your recent work and time logs
- **🔄 Flexible Distribution**: Automatically distribute hours across multiple issues worked on
- **⏸️ Pause/Resume**: Control when automatic logging should run
- **🔒 Secure**: Individual user configurations with encrypted API tokens

## 🚀 Commands

| Command  | Description                     | Usage                                               |
| -------- | ------------------------------- | --------------------------------------------------- |
| `/setup` | Configure your Jira connection  | Set up host, username, token, and JQL query         |
| `/time`  | View work and log time manually | Check work from X days ago and optionally log hours |
| `/pause` | Pause/resume automatic logging  | Toggle scheduled time logging on/off                |
| `/info`  | View your current configuration | Display your Jira setup and settings                |
| `/ping`  | Check if the bot is responsive  | Simple health check command                         |

## 📋 Prerequisites

- Node.js 18+
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

```bash
# Build and run with Docker Compose
npm run dev-docker

# Or manually with Docker
docker build -t discord-jira .
docker run discord-jira
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
- Automatically logs 8 hours to issues you worked on the previous day
- Distributes time proportionally across multiple issues
- Can be paused/resumed per user with the `/pause` command

Schedule configuration can be modified in `src/scheduler/index.ts`:

```typescript
export const dailyRule = "0 6 * * 2-6"; // Cron format
export const hours = 8; // Hours to log daily
```

## 🏗️ Project Structure

```
src/
├── commands/          # Discord slash commands
├── config.ts         # Environment configuration
├── db/               # Database models and setup
├── jira/             # Jira API integration
├── scheduler/        # Automated time logging
└── utils/            # Utility functions and logging
```

## 🔄 Development Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run dev-docker   # Build and run with Docker Compose
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

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
