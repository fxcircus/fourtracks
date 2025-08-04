# Contributing to FourTracks

Thank you for your interest in contributing to FourTracks! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/fourtracks.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Run tests: `npm test`
6. Commit your changes: `git commit -m "Add your feature"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Create a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

## Code Standards

### TypeScript
- Use TypeScript strict mode
- Define proper types for all function parameters and return values
- Avoid using `any` type
- Prefer interfaces over type aliases for object shapes

### File Organization
- Maximum 200 lines per file
- One component per file
- Group related functionality in directories
- Use barrel exports (index.ts) for clean imports

### React Components
- Use functional components with hooks
- Keep components focused and single-purpose
- Extract complex logic into custom hooks
- Use proper prop types with TypeScript

### CSS
- One CSS file per component
- Use CSS modules or scoped styles
- Follow BEM naming convention for classes
- Maintain consistent spacing and colors

### Testing
- Write tests for all new features
- Maintain at least 80% code coverage
- Test both happy paths and error cases
- Use descriptive test names

## Pull Request Process

1. **Before submitting:**
   - Ensure all tests pass
   - Run linting and fix any issues
   - Update documentation if needed
   - Add tests for new functionality

2. **PR Description should include:**
   - Summary of changes
   - Related issue numbers
   - Screenshots for UI changes
   - Breaking changes (if any)

3. **Review process:**
   - PRs require at least one review
   - Address all feedback
   - Keep PRs focused and small
   - Squash commits before merging

## Project Architecture

Please familiarize yourself with the project architecture:

- `src/audio/` - Web Audio API engine (keep audio logic here)
- `src/components/` - React components (UI only)
- `src/hooks/` - Custom React hooks
- `src/utils/` - Utility functions
- `src/types/` - TypeScript type definitions

## Testing Guidelines

### Unit Tests
- Test individual functions and components
- Mock external dependencies
- Focus on logic, not implementation

### Integration Tests
- Test component interactions
- Test audio engine integration
- Verify user workflows

### Manual Testing
- Test in multiple browsers
- Verify audio quality
- Check performance metrics
- Test error scenarios

See [TESTING.md](TESTING.md) for detailed testing documentation.

## Commit Messages

Follow conventional commit format:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process/auxiliary tool changes

Example:
```
feat(audio): add reverb effect to audio engine

Implemented a reverb effect using ConvolverNode with 
adjustable room size and decay parameters.

Closes #123
```

## Documentation

- Update README.md for user-facing changes
- Update inline code comments for complex logic
- Add JSDoc comments for public APIs
- Update architecture docs for structural changes

## Questions?

- Check existing issues and PRs
- Read the documentation
- Ask in discussions
- Create an issue for bugs or feature requests

## Recognition

Contributors will be recognized in:
- The project README
- Release notes
- Special thanks section

Thank you for contributing to FourTracks!