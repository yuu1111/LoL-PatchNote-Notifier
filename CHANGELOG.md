# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-08-06

### Fixed
- 🔧 **ESM Import Path Resolution** - Fixed TypeScript module import paths for ESM compatibility
- 📦 **Module Configuration** - Corrected TypeScript module system configuration
- 🧪 **GitHub Actions Compatibility** - Resolved Node.js compatibility issues in CI/CD pipeline
- ✅ **Integration Tests** - Fixed test errors achieving 166/167 passing tests
- 🔄 **Dependency Review** - Removed conflicting dependency-review-action configuration

### Changed
- 🏗️ **Architecture Refactoring** - Complete modularization of PatchScraper architecture
- 📁 **File Organization** - Renamed index.ts files to more descriptive names for clarity
- 🧹 **Code Cleanup** - Removed deprecated documentation and optimized Scrapers module
- ⚙️ **ESLint Configuration** - Optimized configuration and removed warning suppression comments
- 🔒 **Security Updates** - Fixed vulnerabilities and removed unused husky dependency

### Added
- 💾 **Cache Feature** - Implemented caching mechanism for existing patches
- 🛠️ **Process Management** - Enhanced process termination script functionality

### Technical Improvements
- **Module System** - Migrated to ESM-compatible import system
- **Test Architecture** - Cleaned up tests after major refactoring
- **Code Quality** - Removed all ESLint warning suppression comments
- **CI/CD Pipeline** - Streamlined GitHub Actions workflow

## [1.0.2] - 2025-08-01

### Fixed
- 🔧 **ESLint Compliance** - Fixed all 81 ESLint warnings and strengthened configuration
- 🛡️ **Type Safety** - Enhanced TypeScript type safety with strict error checking
- 🏗️ **CI/CD Compatibility** - Resolved GitHub Actions TypeScript compilation errors
- 🔍 **Code Quality** - Implemented proper type guards and safe type conversions
- 📝 **Prettier Formatting** - Ensured consistent code formatting across all files

### Changed
- ⚠️ **ESLint Configuration** - Changed all warning rules to error rules for stricter validation
- 🎯 **Type Handling** - Improved Cheerio Element type handling with safe assertions
- 🔄 **State Management** - Enhanced StateManager with explicit type conversions
- 📊 **Template Literals** - Added type safety for string interpolation

### Technical Improvements
- **Gemini API Types** - Added proper GenerativeModel and GeminiResult type definitions
- **Nullish Coalescing** - Replaced logical OR with nullish coalescing operators where appropriate
- **Error Handling** - Enhanced error type annotations and safe string conversions
- **Configuration** - Added explicit return type annotations for configuration functions

## [1.0.1] - 2025-08-01

### Added
- 📋 **English Release Rules** - Added standardized English release documentation in CLAUDE.md
- 🌐 **International Accessibility** - Enhanced release process for global users

### Changed
- 🔄 **GitHub Actions Workflow** - Updated release templates to use English descriptions
- 📖 **Release Documentation** - Standardized installation and configuration instructions
- 🏷️ **Tag Messages** - Converted to English for better international accessibility

### Fixed
- 🛠️ **Release Workflow** - Fixed npm pkg command syntax error in GitHub Actions
- 📦 **Artifact Generation** - Improved release artifact packaging process

### Documentation
- 📚 **Development Guidelines** - Enhanced CLAUDE.md with clear release standards
- 🗂️ **Repository Structure** - Better organization of development documentation

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

[1.0.3]: https://github.com/yuu1111/LoL-PatchNote-Notifier/releases/tag/v1.0.3
[1.0.2]: https://github.com/yuu1111/LoL-PatchNote-Notifier/releases/tag/v1.0.2
[1.0.1]: https://github.com/yuu1111/LoL-PatchNote-Notifier/releases/tag/v1.0.1
[1.0.0]: https://github.com/yuu1111/LoL-PatchNote-Notifier/releases/tag/v1.0.0