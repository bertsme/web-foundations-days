// Starting notes array
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// 1. Search notes
function searchNotes(word) {
  return notes.filter(note =>
    note.text.toLowerCase().includes(word.toLowerCase())
  );
}

// 2. Find the longest note
function longestNote() {
  if (notes.length === 0) {
    return null;
  }

  let longest = notes[0];

  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }

  return longest;
}

// 3. Count notes by category
function countByCategory() {
  const counts = {
    personal: 0,
    work: 0,
    study: 0
  };

  for (const note of notes) {
    counts[note.category]++;
  }

  return counts;
}

// 4. Generate a summary
function getSummary() {
  const counts = countByCategory();
  const word = notes.length === 1 ? "note" : "notes";

  return `${notes.length} ${word}: ${counts.personal} personal, ${counts.work} work, ${counts.study} study.`;
}

// 5. Check for duplicate notes
function isDuplicate(text) {
  const normalizedText = text.trim().toLowerCase();

  return notes.some(note =>
    note.text.trim().toLowerCase() === normalizedText
  );
}

// 6. Add a new note
function addNote(text, category) {
  const cleanText = text.trim();
  const validCategories = ["personal", "work", "study"];

  if (cleanText.length < 1 || cleanText.length > 200) {
    console.log("Note must be between 1 and 200 characters.");
    return false;
  }

  if (!validCategories.includes(category)) {
    console.log("Invalid category.");
    return false;
  }

  if (isDuplicate(cleanText)) {
    console.log("Note already exists.");
    return false;
  }

  const newId = notes.length === 0
    ? 1
    : Math.max(...notes.map(note => note.id)) + 1;

  notes.push({
    id: newId,
    text: cleanText,
    category: category
  });

  return true;
}

// TESTS

// Search tests
console.log(searchNotes("milk")); 
// Expected: One matching note, id 1

console.log(searchNotes("pizza")); 
// Expected: []

// Longest note tests
console.log(longestNote()); 
// Expected: Note with id 3

const savedNotes = notes;
notes = [];

console.log(longestNote()); 
// Expected: null

notes = savedNotes;

// Category count tests
console.log(countByCategory()); 
// Expected: { personal: 2, work: 1, study: 2 }

// Empty category count test
const notesBeforeEmptyTest = notes;
notes = [];

console.log(countByCategory()); 
// Expected: { personal: 0, work: 0, study: 0 }

notes = notesBeforeEmptyTest;

// Summary tests
console.log(getSummary()); 
// Expected: 5 notes: 2 personal, 1 work, 2 study.

// Duplicate tests
console.log(isDuplicate("Buy milk and bread")); 
// Expected: true

console.log(isDuplicate("  BUY MILK AND BREAD  ")); 
// Expected: true

console.log(isDuplicate("Buy eggs")); 
// Expected: false

// Add note tests
console.log(addNote("Plan Saturday hike", "personal")); 
// Expected: true

console.log(addNote("Plan Saturday hike", "personal")); 
// Expected: false, duplicate note

console.log(addNote("", "personal")); 
// Expected: false, empty note

console.log(addNote("New task", "invalid")); 
// Expected: false, invalid category

console.log(notes); 
// Expected: Original 5 notes plus the newly added note