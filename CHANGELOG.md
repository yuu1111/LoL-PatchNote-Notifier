# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-01

### Added
- 🎮 **League of Legends Patch Notifier** - Initial release
- 🤖 **AI-Powered Summaries** - Gemini AI integration for automatic Japanese patch note summaries
- 📱 **Rich Discord Notifications** - Enhanced embeds with AI summaries and key changes
- 🔄 **Robust Monitoring System** - Scheduled monitoring with fallback selectors and retry logic
- 💾 **Smart Data Management** - Local caching with organized patch directories
- 🛡️ **Comprehensive Error Handling** - Circuit breaker, exponential backoff, and state recovery
- 📊 **Performance Monitoring** - Winston logging with structured output
- ⚙️ **Environment Configuration** - Comprehensive .env support with validation
- 🚀 **CI/CD Pipeline** - GitHub Actions for testing, security, and automated releases
- 📚 **Complete Documentation** - English and Japanese README with setup guides
- 🔧 **Release Automation** - Cross-platform release scripts with changelog generation

### Technical Details
- **Core Stack**: TypeScript, Node.js 18+, Axios, Cheerio, Winston
- **AI Integration**: Google Gemini 2.5 Flash with 25K token support
- **Monitoring**: 60-minute intervals with 99.5% uptime target
- **Architecture**: Modular service-based design with clean separation
- **Storage**: JSON-based persistence with organized directory structure
- **Quality**: Full test coverage, ESLint, Prettier, and type safety

### Security
- Dependency vulnerability scanning
- OSSF Scorecard integration
- Environment variable validation
- Safe configuration handling

[1.0.0]: https://github.com/yuu1111/LoL-PatchNote-Notifier/releases/tag/v1.0.0