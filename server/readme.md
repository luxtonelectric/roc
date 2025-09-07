# ROC Server

ROC (Railway Operations Controller) server application for managing railway operations, integrating with Discord and SimSig (railway simulation) systems.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure the application:
   ```bash
   cp config.json.example config.json
   # Edit config.json with your settings
   ```

3. Start the server:
   ```bash
   node src/index.js
   ```

## Running Tests

The test suite uses Jest with experimental VM modules support. Here are the different ways to run tests:

### Run All Tests
```bash
NODE_OPTIONS="--experimental-vm-modules" npx jest --coverage
```

### Run Tests Without Coverage
```bash
NODE_OPTIONS="--experimental-vm-modules" npx jest
```

### Run Specific Test File
```bash
NODE_OPTIONS="--experimental-vm-modules" npx jest tests/phonemanager.test.js --verbose
NODE_OPTIONS="--experimental-vm-modules" npx jest tests/model/panel.test.js --verbose
```

### Run Specific Test by Name
```bash
NODE_OPTIONS="--experimental-vm-modules" npx jest --testNamePattern="Panel phone association" --verbose
```

### Watch Mode (Re-run tests on file changes)
```bash
NODE_OPTIONS="--experimental-vm-modules" npx jest --watch
```

### Windows PowerShell Users
If you're using PowerShell on Windows, use this format:
```powershell
$env:NODE_OPTIONS="--experimental-vm-modules"; npx jest --coverage
```

### Windows Command Prompt Users
If you're using cmd on Windows, use this format:
```cmd
set NODE_OPTIONS=--experimental-vm-modules && npx jest --coverage
```

## Test Coverage

The test suite covers:
- **PhoneManager**: Phone creation, assignment, and management
- **Panel Model**: Panel creation and phone associations
- **Phone Model**: Phone functionality and location handling
- **Integration Tests**: Phone-panel associations and game state management

## Test Files

- `tests/phonemanager.test.js` - PhoneManager functionality and integration tests
- `tests/model/panel.test.js` - Panel model unit tests
- `tests/model/phone.test.js` - Phone model unit tests
- `tests/model/iLocatable.test.js` - Location functionality tests

## Debugging Tests

To debug failing tests:
1. Use `--verbose` flag for detailed output
2. Use `console.log()` statements in test files
3. Run specific failing tests in isolation
4. Check the coverage report in `coverage/lcov-report/index.html`