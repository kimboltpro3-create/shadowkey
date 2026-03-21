# Publishing @shadowkey/agent-sdk to npm

This guide explains how to publish the ShadowKey Agent SDK to npm.

## Prerequisites

1. **npm Account**: Create an account at https://www.npmjs.com/signup
2. **npm Login**: Run `npm login` and enter your credentials
3. **Organization Setup** (Optional): If publishing under `@shadowkey`, create an organization at https://www.npmjs.com/org/create

## Pre-Publishing Checklist

Before publishing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Build completes successfully: `npm run build`
- [ ] README.md is up to date
- [ ] Version number is updated in package.json
- [ ] CHANGELOG.md documents all changes (if applicable)

## Publishing Steps

### 1. Build the Package

```bash
cd sdk
npm run build
```

This will generate the distribution files in the `dist/` directory:
- `dist/index.js` - CommonJS bundle
- `dist/index.mjs` - ESM bundle
- `dist/index.d.ts` - TypeScript definitions

### 2. Test the Package Locally (Optional)

Before publishing, you can test the package locally:

```bash
npm pack
```

This creates a `.tgz` file that you can install in another project:

```bash
npm install /path/to/shadowkey-agent-sdk-1.0.0.tgz
```

### 3. Publish to npm

For the first publish:

```bash
npm publish --access public
```

For subsequent updates:

```bash
# Update version first
npm version patch  # or minor, or major
npm publish
```

## Version Management

Follow semantic versioning (semver):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backward compatible

Update version using npm:

```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

## Publishing to a Scoped Package

If publishing under `@shadowkey` organization:

1. Ensure you're a member of the organization
2. Use `--access public` flag (scoped packages are private by default):

```bash
npm publish --access public
```

## CI/CD Publishing (GitHub Actions Example)

Create `.github/workflows/publish.yml`:

```yaml
name: Publish Package

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: |
          cd sdk
          npm ci

      - name: Build
        run: |
          cd sdk
          npm run build

      - name: Publish
        run: |
          cd sdk
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Post-Publishing

After publishing:

1. **Verify Installation**: Test that users can install the package:
   ```bash
   npm install @shadowkey/agent-sdk
   ```

2. **Update Documentation**: Update any references to the new version

3. **Create GitHub Release**: Tag the release in GitHub with release notes

4. **Announce**: Share the release on social media, Discord, etc.

## Troubleshooting

### Error: "You must be logged in to publish packages"

Run `npm login` and authenticate with your npm account.

### Error: "You do not have permission to publish"

Ensure you're a member of the `@shadowkey` organization or use a different scope.

### Error: "Cannot publish over the previously published version"

Update the version number in package.json before publishing.

### Package Size Issues

Check what files will be included:

```bash
npm pack --dry-run
```

Update `.npmignore` to exclude unnecessary files.

## Unpublishing (Emergency Only)

If you need to unpublish a version (use sparingly):

```bash
npm unpublish @shadowkey/agent-sdk@1.0.0
```

**Note**: npm doesn't allow unpublishing versions older than 72 hours that other packages depend on.

## Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [npm CLI Documentation](https://docs.npmjs.com/cli/v9)
