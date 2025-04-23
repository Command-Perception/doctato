// lib/patterns.ts
export const DEFAULT_INCLUDE_PATTERNS: string[] = [
    "*.py", "*.js", "*.jsx", "*.ts", "*.tsx", "*.go", "*.java", "*.pyi", "*.pyx",
    "*.c", "*.cc", "*.cpp", "*.h", "*.hpp", "*.md", "*.rst", "Dockerfile*",
    "Makefile", "*.yaml", "*.yml", "*.json", "*.sh", "*.bash", "docker-compose*",
    "requirements.txt", "pyproject.toml", "package.json", "go.mod", "pom.xml",
    "build.gradle", "Cargo.toml", "README*", "LICENSE*", "*.tf", "*.tfvars",
    "*.bicep", "*.sql", "*.rb", "*.php", "*.html", "*.css", "*.scss", "*.sass",
    "*.vue"
];

export const DEFAULT_EXCLUDE_PATTERNS: string[] = [
    "**/venv/**", "**/.venv/**", "**/*test*/**", "**/tests/**", "**/test/**",
    "**/docs/**", "**/examples/**", "**/samples/**", "**/v1/**", "**/vendor/**",
    "**/dist/**", "**/build/**", "**/*_build/**", "**/experimental/**", "**/deprecated/**",
    "**/legacy/**", "**/.git/**", "**/.github/**", "**/.next/**", "**/.vscode/**",
    "**/obj/**", "**/bin/**", "**/node_modules/**", "**/*cache*/**", "__pycache__/**",
    "**/*.log", "**/*.tmp", "**/*.swp", "**/*.bak", "**/*.pyc", "**/*.pyo",
    "**/*.class", "**/*.jar", "**/*.war", "**/*.ear", "**/*.dll", "**/*.exe",
    "**/*.o", "**/*.so", "**/*.a", "**/*.dylib", "**/target/**", "**/coverage/**",
    "**/.DS_Store", "**/Thumbs.db", "**/.idea/**", "**/.project", "**/.classpath",
    "**/.settings/**", "*.lock", "yarn.lock", "package-lock.json", "bun.lockb",
    "poetry.lock", "Pipfile.lock", "go.sum", "**/Pods/**", "*.xcodeproj/**",
    "**/.env*", "**/*.env", "**/migrations/**", "**/db/schema.rb",
    "**/*.min.*", // Exclude minified files
    "**/static/**", "**/public/**", // Often contain built assets or large media
    "**/assets/**", // Common directory for large media
];

export const DEFAULT_MAX_FILE_SIZE = 100 * 1024; // 100 KB