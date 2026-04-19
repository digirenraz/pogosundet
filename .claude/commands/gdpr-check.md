# /gdpr-check

Review a feature or piece of code for GDPR compliance.

## What to do

Go through each item below and give a clear ✅ or ❌ with a one-line explanation.
If something is ❌, explain what needs to change before this can be merged.

## Checklist

1. **Data storage location**
   - Is all personal data stored in Supabase EU/Ireland region?
   - Are any third-party services involved that might store data outside the EU?

2. **Consent**
   - If this feature collects personal data at registration, is there an explicit,
     un-pre-ticked consent checkbox?
   - Is the consent recorded (e.g. timestamp + version in the database)?

3. **Data minimisation**
   - Does this feature collect only the data it actually needs?
   - Are there any fields being stored that have no clear purpose?

4. **Account deletion**
   - If this feature stores new user data, is that data included in the account
     deletion flow?
   - Will a full account delete remove this data completely?

5. **Third-party tracking**
   - Does this feature introduce any analytics, tracking pixels, or third-party
     scripts?
   - If yes: is there a consent mechanism in place before they load?

6. **Privacy Policy**
   - Does this feature involve data processing that is not yet covered by the
     Privacy Policy page?
   - If yes: flag for copy update before launch.

## Output

Summarise as:
- ✅ All checks passed — safe to merge
- ⚠️ Minor issues — list them, confirm with product owner before merging
- ❌ Blocking issues — list them, must be resolved before merging
