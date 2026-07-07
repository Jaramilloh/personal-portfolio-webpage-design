import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Extract the JSON template string from a bundled HTML file.
 * The template lives inside <script type="__bundler/template">...</script>
 * and is a JSON-encoded string containing the full HTML document.
 */
function extractTemplateJson(html) {
  const startMarker = '<script type="__bundler/template">\n';
  const endMarker = '\n  </script>';
  
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker, startIdx);
  
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not find __bundler/template markers');
  }
  
  return html.slice(startIdx + startMarker.length, endIdx);
}

describe('bundled page integrity', () => {
  const bundlePath = join(root, 'writing', 'dev-env-setup.html');
  const html = readFileSync(bundlePath, 'utf8');
  
  describe('template JSON validity', () => {
    it('contains a valid JSON template string', () => {
      const jsonStr = extractTemplateJson(html);
      expect(() => JSON.parse(jsonStr)).not.toThrow();
    });
    
    it('template parses to a complete HTML document', () => {
      const jsonStr = extractTemplateJson(html);
      const template = JSON.parse(jsonStr);
      
      expect(template).toContain('<!DOCTYPE html>');
      expect(template).toContain('</html>');
      expect(template).toContain('<body>');
      expect(template).toContain('</body>');
    });
  });
  
  describe('HTML parser safety', () => {
    it('does not contain unescaped </script> that would break HTML parsing', () => {
      const jsonStr = extractTemplateJson(html);
      
      // The browser's HTML parser treats </script> as closing the current
      // script tag, even inside a JSON string. This causes the template
      // to be truncated, resulting in "unterminated string" JSON errors.
      //
      // Safe alternatives: <\/script>, </scr + ipt>, <\u002Fscript>
      // We check for the literal sequence that would break parsing.
      
      // Look for </script> that isn't escaped as <\/script>
      // The pattern </script (case-insensitive) followed by > is dangerous
      const dangerousPattern = /<\/script\s*>/gi;
      const matches = jsonStr.match(dangerousPattern);
      
      expect(matches).toBeNull();
    });

    it('does not contain a literal </x-dc> that the runtime re-parse would mis-extract', () => {
      const jsonStr = extractTemplateJson(html);

      // The dc-runtime boot() renders the clean DOM first, then runs
      // `fetch(location.href)` on the raw bundle file and calls parseDcText()
      // on the text. parseDcText slices between `<x-dc...>` and the LAST
      // literal `</x-dc>`. In the raw file the template lives JSON-encoded,
      // so a literal `</x-dc>` lets parseDcText extract the *escaped* template
      // (quotes as \", newlines as \n) and updateHtml() overwrites the good
      // render with that garbage — the page shows literal \n and \" everywhere.
      //
      // Encoding every `</` as `<\/` (valid JSON escape for `</`, decoded back
      // to `</` by the loader's JSON.parse) removes the literal closing tag, so
      // lastIndexOf('</x-dc>') returns -1 and the re-parse is a no-op.
      expect(jsonStr).not.toContain('</x-dc>');
    });

    it('escapes every closing tag so no literal </ leaks into the raw file', () => {
      const jsonStr = extractTemplateJson(html);

      // Any literal `</tag>` in the encoded template line is a latent hazard:
      // `</script>` truncates the host <script> tag, `</x-dc>` derails the
      // runtime re-parse. The canonical bundler encoding escapes them all as
      // `<\/tag>`. Assert there is no unescaped `</` left on the template line.
      const unescaped = (jsonStr.match(/(^|[^\\])<\//g) || []).length;
      expect(unescaped).toBe(0);
    });

    it('template has matching opening and closing script tags', () => {
      const jsonStr = extractTemplateJson(html);
      const template = JSON.parse(jsonStr);
      
      const openScripts = (template.match(/<script/g) || []).length;
      const closeScripts = (template.match(/<\/script>/g) || []).length;
      
      expect(openScripts).toBe(closeScripts);
      expect(openScripts).toBeGreaterThan(0);
    });
    
    it('escapes closing script tags as <\\/script>', () => {
      const jsonStr = extractTemplateJson(html);
      
      // If the template contains script tags, they should be escaped
      // as <\/script> (with backslash) which is safe in JSON and prevents
      // the HTML parser from treating it as a closing tag.
      
      // Count escaped vs unescaped
      const escaped = (jsonStr.match(/<\\\/script>/gi) || []).length;
      const unescaped = (jsonStr.match(/<\/script\s*>/gi) || []).length;
      
      // All script closing tags should be escaped
      expect(unescaped).toBe(0);
      
      // Parse and verify the template has proper closing tags
      const template = JSON.parse(jsonStr);
      const openScripts = (template.match(/<script/g) || []).length;
      const closeScripts = (template.match(/<\/script>/g) || []).length;
      
      // If there are open script tags, there must be matching close tags
      if (openScripts > 0) {
        expect(closeScripts).toBe(openScripts);
        // And the JSON must have had escaped closing tags
        expect(escaped).toBeGreaterThan(0);
      }
    });
  });
  
  describe('content integrity', () => {
    it('contains all 9 stages of the DevEnvSetup guide', () => {
      const jsonStr = extractTemplateJson(html);
      const template = JSON.parse(jsonStr);
      
      for (let i = 1; i <= 9; i++) {
        expect(template).toContain(`etapa${i}`);
      }
    });
    
    it('includes SSH key setup sections (6.4, 6.5, 6.6)', () => {
      const jsonStr = extractTemplateJson(html);
      const template = JSON.parse(jsonStr);
      
      // Section 6.4: Generate SSH key
      expect(template).toContain('ssh-keygen');
      expect(template).toContain('id_ed25519');
      
      // Section 6.5: Add SSH key to GitHub
      expect(template).toContain('SSH and GPG keys');
      
      // Section 6.6: Authenticate with gh CLI
      expect(template).toContain('gh auth login');
      expect(template).toContain('ssh -T git@github.com');
    });
  });
});
