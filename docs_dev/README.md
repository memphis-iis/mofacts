# MoFaCTS Development Documentation

This directory contains design documents, implementation guides, and technical documentation for the MoFaCTS project.

## Directory Structure

### Core Design Documents
- **[SPEECH_RECOGNITION_STATE_MACHINE.md](SPEECH_RECOGNITION_STATE_MACHINE.md)** - Core state machine design for speech recognition
- **[STATE_MACHINE_IMPLEMENTATION_PLAN.md](STATE_MACHINE_IMPLEMENTATION_PLAN.md)** - Detailed implementation plan for state machine
- **[STATE_MACHINE_SAFETY_ASSESSMENT.md](STATE_MACHINE_SAFETY_ASSESSMENT.md)** - Safety analysis and risk assessment
- **[STATE_MACHINE_TRACING_GUIDE.md](STATE_MACHINE_TRACING_GUIDE.md)** - Debugging and tracing guide

### Security Documentation
- **[SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md)** - Comprehensive security audit findings
- **[SECURITY_STATUS_SUMMARY.md](SECURITY_STATUS_SUMMARY.md)** - Current security status and priorities
- **[INNERHTML_AUDIT_REPORT.md](INNERHTML_AUDIT_REPORT.md)** - innerHTML usage audit and XSS prevention
- **[SECURITY_QUICK_WINS.md](SECURITY_QUICK_WINS.md)** - Quick security improvements (mostly completed)

### Operations & Deployment
- **[DEPLOYING.md](DEPLOYING.md)** - Deployment procedures and guidelines
- **[database_recovery_commands.md](database_recovery_commands.md)** - Database backup and recovery procedures
- **[METEOR_2.0_UPGRADE_GUIDE.md](METEOR_2.0_UPGRADE_GUIDE.md)** - Complete guide for upgrading from Meteor 1.12 to 2.0

### Planning
- **[main_developement_plan.md](main_developement_plan.md)** - Main development roadmap and priorities

## Archive

Completed task documentation is archived in `archive/completed_sr_fixes/` including:
- Speech recognition bug fixes
- Phonetic matching implementation
- UI redesign notes
- Diagnostic logging additions

## Contributing

When adding new documentation:
1. Use descriptive filenames with proper prefixes (e.g., `SR_` for speech recognition, `SECURITY_` for security)
2. Include date and purpose in file header
3. Move completed task docs to archive when finished
4. Update this README when adding major documentation
