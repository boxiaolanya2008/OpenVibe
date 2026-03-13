---
name: testing
description: Testing strategies and patterns for unit, integration, and end-to-end tests. Use when writing tests or improving test coverage.
---

# Testing Skill

Comprehensive testing strategies for building reliable software.

## Test Types

### Unit Tests
- Test individual functions/methods in isolation
- Mock external dependencies
- Fast execution, run frequently
- One concept per test

### Integration Tests
- Test component interactions
- Use real databases/APIs when practical
- Slower than unit tests
- Test critical paths

### End-to-End Tests
- Test complete user flows
- Simulate real user behavior
- Slowest but most comprehensive
- Focus on critical business flows

## Test Structure (AAA Pattern)

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      // Arrange
      const userData = { name: 'John', email: 'john@example.com' };
      
      // Act
      const user = await userService.createUser(userData);
      
      // Assert
      expect(user.id).toBeDefined();
      expect(user.name).toBe('John');
    });
  });
});
```

## Best Practices

### Naming Conventions
- Describe what the test does: `should...` or `when...`
- Use descriptive test names
- Group related tests with `describe`

### Test Isolation
- Each test should be independent
- No shared state between tests
- Use setup/teardown for fixtures

### Assertions
- One logical assertion per test concept
- Use meaningful assertion messages
- Test both success and failure cases

### Mocking Guidelines
- Mock external services and APIs
- Don't mock what you're testing
- Keep mocks simple and focused

## Coverage Guidelines

| Type | Target |
|------|--------|
| Unit | 80%+ |
| Integration | Critical paths |
| E2E | Key user flows |

## Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- user.test.ts

# Run tests in watch mode
npm test -- --watch
```
