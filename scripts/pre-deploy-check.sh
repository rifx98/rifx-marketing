#!/bin/bash

# Pre-Deploy Validation Script
# Verifica que todo esté listo para producción

set -e

echo "🔍 RIFX Marketing - Pre-Deploy Validation"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print colored output
print_error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    ((WARNINGS++))
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Check 1: Node modules installed
echo "Checking dependencies..."
if [ -d "node_modules" ]; then
    print_success "Dependencies installed"
else
    print_error "node_modules not found. Run: npm install"
fi

# Check 2: .env.local exists
echo ""
echo "Checking environment files..."
if [ -f ".env.local" ]; then
    print_success ".env.local exists"

    # Check critical variables
    if grep -q "JWT_SECRET=" .env.local; then
        JWT_LEN=$(grep "JWT_SECRET=" .env.local | cut -d'=' -f2 | wc -c)
        if [ $JWT_LEN -gt 32 ]; then
            print_success "JWT_SECRET length OK (≥32 chars)"
        else
            print_error "JWT_SECRET too short (<32 chars)"
        fi
    else
        print_error "JWT_SECRET not found in .env.local"
    fi

    if grep -q "UPSTASH_REDIS_REST_URL=" .env.local; then
        print_success "UPSTASH_REDIS_REST_URL configured"
    else
        print_warning "UPSTASH_REDIS_REST_URL not in .env.local (required for production)"
    fi

else
    print_warning ".env.local not found"
fi

# Check 3: No hardcoded secrets
echo ""
echo "Checking for hardcoded secrets..."
SECRETS=$(grep -rE "(sk-proj-|gsk_[a-zA-Z0-9]{20,}|eyJ[a-zA-Z0-9]{100,})" app/ components/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -z "$SECRETS" ]; then
    print_success "No hardcoded secrets found"
else
    print_error "Found potential hardcoded secrets:"
    echo "$SECRETS"
fi

# Check 4: No console.logs in production code
echo ""
echo "Checking for console.logs..."
CONSOLE_LOGS=$(grep -r "console\.\(log\|error\|warn\)" app/api/ --include="*.ts" 2>/dev/null | grep -v "NODE_ENV" | wc -l || true)
if [ "$CONSOLE_LOGS" -eq 0 ]; then
    print_success "No unprotected console.logs in APIs"
else
    print_warning "Found $CONSOLE_LOGS unprotected console.logs in app/api/"
    echo "  (Should be wrapped in: if (process.env.NODE_ENV === 'development'))"
fi

# Check 5: Build succeeds
echo ""
echo "Testing build..."
if npm run build > /dev/null 2>&1; then
    print_success "Build succeeds"
else
    print_error "Build failed. Run: npm run build"
fi

# Check 6: Git status
echo ""
echo "Checking git status..."
if git diff-index --quiet HEAD -- 2>/dev/null; then
    print_success "No uncommitted changes"
else
    print_warning "You have uncommitted changes"
fi

# Check 7: Critical files exist
echo ""
echo "Checking critical files..."
FILES=("middleware.ts" "lib/auth.ts" "lib/rate-limit.ts" "app/api/auth/phone/send-otp/route.ts")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_error "$file not found"
    fi
done

# Check 8: package.json audit
echo ""
echo "Running npm audit..."
VULNERABILITIES=$(npm audit --json 2>/dev/null | grep -o '"high":[0-9]*' | cut -d':' -f2 || echo "0")
if [ "$VULNERABILITIES" -eq 0 ]; then
    print_success "No high/critical vulnerabilities"
else
    print_warning "Found $VULNERABILITIES high/critical vulnerabilities"
    echo "  Run: npm audit fix"
fi

# Summary
echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for production.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warnings found. Review before deploying.${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS errors found. Fix before deploying.${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}   Also: $WARNINGS warnings to review.${NC}"
    fi
    exit 1
fi
