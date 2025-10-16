# Deployment Notes

## Recent Deployments

### October 13, 2025 - Security Fixes (Authorization, XSS, Password Reset)

**Commits:** 84147b80, 01229bf5, b3ed661c

**IMPORTANT: New NPM Package Required**

After transferring files, you MUST run:
```bash
cd ~/mofacts-2/mofacts/mofacts
meteor npm install
```

**Why:** We added `dompurify@3.0.6` to package.json for XSS protection. Without running npm install, the application will crash with "no route definitions found" error because the import fails.

**Files Changed:**
- mofacts/package.json - Added dompurify dependency
- mofacts/client/index.js - Imports DOMPurify
- mofacts/client/views/experiment/card.js - Imports DOMPurify
- mofacts/client/views/experiment/instructions.js - Imports DOMPurify
- mofacts/server/methods.js - Authorization checks, password reset methods
- mofacts/common/Collections.js - PasswordResetTokens collection

**Testing After Deployment:**
1. ✅ Login page loads
2. ✅ Can log in successfully
3. ✅ Trial cards display properly (images, text)
4. ✅ Instructions display with HTML formatting
5. ✅ Server methods require proper authorization
6. ✅ Password reset uses new token system

---

## Deployment Checklist

### Every Deployment:
1. [ ] Transfer files using SCP script
2. [ ] Check if package.json was modified
3. [ ] If YES: Run `meteor npm install`
4. [ ] Restart meteor (if needed)
5. [ ] Test login page loads
6. [ ] Test basic functionality

### When package.json Changes:
- Always run `meteor npm install`
- Wait for package installation to complete
- Check for any npm errors
- Restart meteor after installation

### When Collections.js Changes:
- No database migration needed (Meteor auto-creates collections)
- But if indexes needed, add them manually

### Common Errors:
- "no route definitions found" → JavaScript syntax error OR missing npm package
- "Cannot find module" → Missing npm package, run npm install
- Images not displaying → Check commits for defensive null checks
- Methods throwing 401/403 → New authorization checks (expected behavior)

---

## Emergency Rollback

If deployment breaks the application:

```bash
cd ~/mofacts-2/mofacts/mofacts
git log --oneline -5  # Find last good commit
git checkout <commit-hash>
meteor npm install  # Install dependencies for that version
# Restart meteor
```

---

## Version History

- **Oct 13, 2025**: Security fixes - Authorization, XSS, Password Reset
- **Oct 12, 2025**: Security quick wins - TLS, eval(), cookies, headers
- **Previous**: FOUC fixes, Bootstrap 5 migration
