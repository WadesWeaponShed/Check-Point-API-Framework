// Shell command formatting only; this module never executes a command.
export function formatClishPasswordCommand(username, hash) {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(username)) {
    throw new Error('Enter a Gaia username of 1–32 letters, digits, underscores or hyphens.');
  }
  if (!/^\$6\$[./A-Za-z0-9]{16}\$[./A-Za-z0-9]{86}$/.test(hash)) {
    throw new Error('Generate a valid SHA-512 crypt hash first.');
  }
  const escaped = hash.replaceAll('$', '\\$');
  return `clish -c "set user ${username} password-hash ${escaped}"`;
}
