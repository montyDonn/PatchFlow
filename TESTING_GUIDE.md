# Testing Guide - PatchFlow Project

Quick reference for running and maintaining tests across all components.

## Quick Start

### 1. Run All Tests at Once

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Run Spring Boot tests
cd backend-spring && mvn test

# Terminal 3: Run Node.js backend tests
cd backend && npm test

# Terminal 4: Run frontend tests
cd frontend && npm test -- --run
```

### 2. Individual Test Commands

**Spring Boot Backend** (Java/Maven)
```bash
cd backend-spring
mvn test                    # Run all tests
mvn test -Dtest=HealthCheckTest  # Run specific test
mvn clean test             # Clean and test
```

**Node.js Backend** (Express/Jest)
```bash
cd backend
npm test                   # Run tests once
npm run test:watch        # Run in watch mode
npm test -- --coverage    # With coverage
```

**React Frontend** (Vitest)
```bash
cd frontend
npm test -- --run         # Run tests once
npm test                  # Run in watch mode
npm test -- --coverage    # With coverage
```

## Test Files Location

### Spring Boot Tests
```
backend-spring/
├── src/test/java/com/patchflow/
│   ├── PatchFlowApplicationTests.java
│   └── controller/
│       └── HealthCheckTest.java
```

### Node.js Tests
```
backend/
├── src/__tests__/
│   └── health.test.ts
├── jest.config.js
└── package.json (test script)
```

### React Tests
```
frontend/
├── src/__tests__/
│   ├── App.test.tsx
│   └── api.test.ts
├── vitest.config.ts
└── package.json (test script)
```

## Adding New Tests

### Spring Boot Test Example
```java
@SpringBootTest
class MyFeatureTest {
    @Test
    void testSomething() {
        // Arrange
        // Act
        // Assert
    }
}
```

### Node.js Test Example
```typescript
describe('My Feature', () => {
  it('should do something', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### React Test Example
```typescript
describe('MyComponent', () => {
  it('should render', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Configuration Files

- **backend-spring/pom.xml** - Maven dependencies for testing
- **backend/jest.config.js** - Jest test runner configuration
- **backend/tsconfig.json** - TypeScript configuration (test types)
- **frontend/vitest.config.ts** - Vitest configuration
- **frontend/src/setupTests.ts** - Frontend test setup

## Test Frameworks

| Component | Framework | Version | Configuration |
|-----------|-----------|---------|---|
| Spring Boot | JUnit 5 | 5.9+ | pom.xml |
| Node.js | Jest | 29.5.0 | jest.config.js |
| React | Vitest | 1.6.1 | vitest.config.ts |

## Troubleshooting

### Spring Boot Tests Fail
- Check database connection string in application.yml
- Verify @SpringBootTest annotation is correct
- Run `mvn clean test` to clear cache

### Node.js Tests Not Found
- Ensure test files are in `src/__tests__/` or match `*.test.ts`
- Check jest.config.js has correct test path pattern
- Run `npm test -- --listTests` to see detected tests

### React Tests Fail
- Clear node_modules: `rm -rf frontend/node_modules && npm install`
- Check vitest.config.ts has correct environment setup
- Verify jsdom is installed: `npm install --save-dev jsdom`

## CI/CD Integration

To integrate with GitHub Actions:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: actions/setup-java@v3
      - run: cd backend-spring && mvn test
      - run: cd backend && npm install && npm test
      - run: cd frontend && npm install --legacy-peer-deps && npm test -- --run
```

## Best Practices

1. **Write tests as you code** - Don't write all tests at the end
2. **Test behavior, not implementation** - Focus on what it does
3. **Keep tests focused** - One test per behavior
4. **Use descriptive names** - Test names should explain what they test
5. **Maintain test data** - Keep test data organized and realistic
6. **Run tests frequently** - Catch issues early
7. **Use watch mode during development** - Get instant feedback

## Performance Tips

- Use `npm test -- --maxWorkers=2` to limit parallel tests
- Run tests on different machines to catch environment issues
- Profile slow tests: `npm test -- --logHeapUsage`
- Exclude node_modules from test runs

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Spring Boot Testing](https://spring.io/guides/gs/testing-web/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
