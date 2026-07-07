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
      
      // If there are any script tags, they should be escaped
      if (escaped > 0 || unescaped > 0) {
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
