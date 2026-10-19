"use strict";

const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearButton = document.querySelector("#clear-btn");
const themeButton = document.querySelector("#theme-toggle");

const DRAFT_KEY = "day4-note-draft";
const THEME_KEY = "day4-note-theme";

function updateCounts() {
  const characterTotal = noteText.value.length;
  const words = noteText.value.trim().match(/\S+/g) || [];

  charCount.textContent = `${characterTotal} / 200 characters`;
  wordCount.textContent = `${words.length} ${words.length === 1 ? "word" : "words"}`;

  charCount.classList.toggle("warning", characterTotal > 180 && characterTotal <= 200);
  charCount.classList.toggle("over", characterTotal > 200);
}

function saveDraft() {
  if (noteText.value) {
    localStorage.setItem(DRAFT_KEY, noteText.value);
  } else {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function clearNote() {
  noteText.value = "";
  updateCounts();
  localStorage.removeItem(DRAFT_KEY);
}

function setTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeButton.textContent = isDark ? "Light mode" : "Dark mode";
}

noteText.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

clearButton.addEventListener("click", clearNote);

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

themeButton.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark");
  setTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});

const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  noteText.value = savedDraft;
}

setTheme(localStorage.getItem(THEME_KEY) === "dark");
updateCounts();
