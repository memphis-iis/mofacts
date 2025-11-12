#!/usr/bin/env python3
"""
Analyze multi-line comment blocks in card.js and generate compression mapping.
"""

import re
import json

def analyze_comment_blocks(filepath):
    """Find and analyze all multi-line comment blocks (2+ consecutive lines)."""

    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    blocks = []
    current_block = None

    for i, line in enumerate(lines, 1):
        # Check if line is a comment (starting with //)
        stripped = line.lstrip()
        if stripped.startswith('//'):
            comment_text = stripped[2:].strip()

            if current_block is None:
                # Start new block
                current_block = {
                    'startLine': i,
                    'endLine': i,
                    'lines': [comment_text]
                }
            else:
                # Continue block
                current_block['endLine'] = i
                current_block['lines'].append(comment_text)
        else:
            # Non-comment line - finish current block if it exists
            if current_block is not None:
                # Only keep blocks with 2+ lines
                if len(current_block['lines']) >= 2:
                    blocks.append(current_block)
                current_block = None

    # Handle case where file ends with a comment block
    if current_block is not None and len(current_block['lines']) >= 2:
        blocks.append(current_block)

    return blocks

def compress_block(block):
    """Generate semantic compression for a comment block."""
    lines = block['lines']
    full_text = ' '.join(lines)

    # Pattern-based semantic compression
    compressions = {
        # Phase/Section markers
        r'={3,}.*PHASE.*={3,}': lambda m: '// ' + re.search(r'PHASE[^=]*', full_text).group().strip(),
        r'={3,}': lambda m: '// ' + lines[0] if lines else '// Section marker',
        r'/{3,}': lambda m: '// ' + lines[0] if lines else '// Section divider',

        # State machine related
        r'STATE MACHINE': lambda m: '// STATE MACHINE: ' + (lines[1] if len(lines) > 1 else lines[0]),
        r'TRANSITION': lambda m: '// State transition: ' + full_text[:80],

        # Fix/Bug related
        r'FIX:|FIXED:|BUG:': lambda m: '// FIX: ' + full_text[:100].replace('FIX:', '').replace('FIXED:', '').replace('BUG:', '').strip(),

        # Performance/Optimization
        r'PERFORMANCE|OPTIMIZATION': lambda m: '// PERF: ' + full_text[:100],

        # Security
        r'SECURITY|XSS|SANITIZE': lambda m: '// SECURITY: ' + full_text[:100],

        # Defensive/Critical
        r'CRITICAL:|DEFENSIVE:|IMPORTANT:': lambda m: '// ' + full_text[:120],

        # Accessibility
        r'ACCESSIBILITY|ARIA|screen reader': lambda m: '// A11Y: ' + full_text[:100],

        # MO/M3 markers (optimization work)
        r'M3:|MO\d+:': lambda m: '// ' + full_text[:120],

        # TODO/NOTE/WARNING
        r'TODO:|NOTE:|WARNING:': lambda m: '// ' + full_text[:100],

        # Helper function descriptions
        r'Helper function': lambda m: '// Helper: ' + full_text[:80],

        # Scenario descriptions
        r'Scenario \d+': lambda m: '// ' + full_text[:100],
    }

    # Try pattern matching
    for pattern, compress_fn in compressions.items():
        if re.search(pattern, full_text, re.IGNORECASE):
            return compress_fn(None)

    # Default compression strategies based on content analysis

    # Check if it's explaining what something does
    if any(keyword in full_text.lower() for keyword in ['this ', 'we ', 'note that', 'function', 'called']):
        # Extract key action/purpose
        if len(full_text) <= 120:
            return '// ' + full_text
        else:
            # Take first substantial sentence
            sentences = re.split(r'[.!?]\s+', full_text)
            if sentences:
                return '// ' + sentences[0][:120]

    # Check if it's configuration/settings
    if any(keyword in full_text.lower() for keyword in ['setting', 'config', 'option', 'parameter']):
        return '// Config: ' + full_text[:100]

    # Check if it's describing logic flow
    if any(keyword in full_text.lower() for keyword in ['if ', 'when ', 'check ', 'handle']):
        return '// Logic: ' + full_text[:100]

    # Default: take first line if short enough, otherwise summarize
    if len(lines[0]) <= 100:
        return '// ' + lines[0]
    else:
        return '// ' + full_text[:120]

def main():
    filepath = r'c:\Users\ppavl\OneDrive\Active projects\mofacts\mofacts\client\views\experiment\card.js'

    print("Analyzing comment blocks in card.js...")
    blocks = analyze_comment_blocks(filepath)

    print(f"Found {len(blocks)} multi-line comment blocks (2+ consecutive lines)")

    # Generate compression mapping
    result = []
    for i, block in enumerate(blocks, 1):
        compressed = compress_block(block)
        result.append({
            'blockNum': i,
            'startLine': block['startLine'],
            'endLine': block['endLine'],
            'lineCount': len(block['lines']),
            'preview': ' '.join(block['lines'][:2])[:100] + ('...' if len(' '.join(block['lines'][:2])) > 100 else ''),
            'compressed': compressed
        })

    # Output JSON
    output_file = r'c:\Users\ppavl\OneDrive\Active projects\mofacts\comment_compression_mapping.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\nGenerated compression mapping saved to: {output_file}")
    print(f"Total blocks: {len(result)}")

    # Print summary
    print("\n=== SAMPLE OUTPUT (first 5 blocks) ===")
    for item in result[:5]:
        print(f"\nBlock {item['blockNum']} (lines {item['startLine']}-{item['endLine']}, {item['lineCount']} lines)")
        print(f"Preview: {item['preview']}")
        print(f"Compressed: {item['compressed']}")

    print(f"\n=== BLOCKS 21-30 (continuing from previous analysis) ===")
    for item in result[20:30]:
        print(f"\nBlock {item['blockNum']} (lines {item['startLine']}-{item['endLine']}, {item['lineCount']} lines)")
        print(f"Preview: {item['preview']}")
        print(f"Compressed: {item['compressed']}")

if __name__ == '__main__':
    main()
