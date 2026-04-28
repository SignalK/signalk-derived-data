// Activates chai's should-style assertions for the whole test suite.
// In @types/chai 5.x the `Object.should` global augmentation moved out
// of the main entry into this side-effect module, so importing it once
// here is enough for TypeScript to apply the augmentation across every
// test file. The runtime `chai.should()` calls in individual tests keep
// working (they're idempotent), so we don't have to touch each file.
import 'chai/register-should'
