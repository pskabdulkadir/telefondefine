
import fs from 'fs';
const content = fs.readFileSync('client/App.tsx', 'utf8');
const lines = content.split('\n');
// We want to remove lines 517 to 523 (1-indexed)
// lines[516] is line 517
const newLines = [
  ...lines.slice(0, 516),
  ...lines.slice(523)
];
fs.writeFileSync('client/App.tsx', newLines.join('\n'));
console.log('Fixed App.tsx');
