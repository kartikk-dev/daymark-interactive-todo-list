
"use strict";

const STORAGE_KEY = "daymark.tasks.v1";

const elements = {
  form: document.querySelector("#task-form"),
  input: document.querySelector("#task-input"),
  feedback: document.querySelector("#form-feedback"),
  taskList: document.querySelector("#task-list"),
  filterGroup: document.querySelector(".filter-group"),
  filterButtons: document.querySelectorAll("[data-filter]"),
  filterAllCount: document.querySelector("#filter-all-count"),
  remainingCount: document.querySelector("#remaining-count"),
  clearCompleted: document.querySelector("#clear-completed"),
  saveStatus: document.querySelector("#save-status"),
  currentDate: document.querySelector("#current-date"),
  listSummary: document.querySelector("#list-summary"),
  confirmDialog: document.querySelector("#confirm-dialog"),
};

let tasks = loadTasks();
let activeFilter = "all";
let feedbackTimer = null;

// Restore valid tasks from localStorage.
function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (!savedTasks) {
      return [];
    }

    const parsedTasks = JSON.parse(savedTasks);

    if (!Array.isArray(parsedTasks)) {
      return [];
    }

    const validTasks = [];
    const seenIds = new Set();

    for (const task of parsedTasks) {
      const validTask =
        task &&
        typeof task.id === "string" &&
        task.id.trim() !== "" &&
        typeof task.title === "string" &&
        task.title.trim() !== "" &&
        task.title.length <= 200 &&
        typeof task.completed === "boolean" &&
        Number.isFinite(task.createdAt) &&
        Number.isFinite(new Date(task.createdAt).getTime()) &&
        !seenIds.has(task.id);

      if (!validTask) {
        continue;
      }

      seenIds.add(task.id);

      validTasks.push({
        id: task.id,
        title: task.title.trim(),
        completed: task.completed,
        createdAt: task.createdAt,
      });
    }

    return validTasks;
  } catch (error) {
    console.error("Unable to load saved tasks:", error);
    return [];
  }
}

// Update the saved status indicator safely.
function setSaveStatus(message, hasError = false) {
  const content = [];

  if (!hasError) {
    const dot = document.createElement("span");
    dot.className = "status-dot";
    dot.setAttribute("aria-hidden", "true");

    content.push(dot);
  }

  content.push(document.createTextNode(message));

  elements.saveStatus.replaceChildren(...content);
  elements.saveStatus.classList.toggle("is-error", hasError);
}

// Save the current task list.
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    setSaveStatus("Saved locally");

    return true;
  } catch (error) {
    console.error("Unable to save tasks:", error);

    setSaveStatus("Storage unavailable", true);

    showFeedback(
      "Changes could not be saved. Check your browser storage settings.",
      "error"
    );

    return false;
  }
}

// Show clear feedback without making every message look like an error.
function showFeedback(message, type = "success") {
  elements.feedback.textContent = message;
  elements.feedback.classList.toggle("is-error", type === "error");

  clearTimeout(feedbackTimer);

  if (!message) {
    return;
  }

  feedbackTimer = setTimeout(() => {
    elements.feedback.textContent = "";
    elements.feedback.classList.remove("is-error");
  }, 4000);
}

// Display today's date using the local timezone.
function updateDate() {
  const now = new Date();

  elements.currentDate.textContent = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);

  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  elements.currentDate.dateTime = localDate;
}

// Create a new task with a unique ID.
function createTask(title) {
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id,
    title,
    completed: false,
    createdAt: Date.now(),
  };
}

// Save changes and refresh the interface.
function commitChanges(message) {
  const saved = saveTasks();

  render();

  if (saved && message) {
    showFeedback(message);
  }
}

// Add a task through the form or Enter key.
function handleFormSubmit(event) {
  event.preventDefault();

  const title = elements.input.value.trim();

  if (!title) {
    showFeedback("Enter a task before submitting.", "error");
    elements.input.focus();
    return;
  }

  if (title.length > 200) {
    showFeedback("Tasks cannot exceed 200 characters.", "error");
    elements.input.focus();
    return;
  }

  tasks.unshift(createTask(title));
  activeFilter = "all";
  elements.input.value = "";

  commitChanges("Task added.");
  elements.input.focus();
}

// Toggle a task between active and completed.
function toggleTask(id) {
  const task = tasks.find((item) => item.id === id);

  if (!task) {
    return;
  }

  task.completed = !task.completed;

  commitChanges(
    task.completed ? "Task completed." : "Task marked active."
  );
}

// Delete a task.
function deleteTask(id) {
  const exists = tasks.some((task) => task.id === id);

  if (!exists) {
    return;
  }

  tasks = tasks.filter((task) => task.id !== id);

  commitChanges("Task deleted.");
}

// Return tasks matching the selected filter.
function getVisibleTasks() {
  if (activeFilter === "active") {
    return tasks.filter((task) => !task.completed);
  }

  if (activeFilter === "completed") {
    return tasks.filter((task) => task.completed);
  }

  return [...tasks];
}

// Format the date and time when a task was added.
function formatTaskDate(timestamp) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

// Build task elements using safe DOM methods.
function createTaskElement(task) {
  const article = document.createElement("article");
  article.className = "task-item";
  article.dataset.id = task.id;

  if (task.completed) {
    article.classList.add("is-completed");
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.completed;
  checkbox.dataset.action = "toggle";

  checkbox.setAttribute(
    "aria-label",
    task.completed
      ? `Mark as active: ${task.title}`
      : `Mark as completed: ${task.title}`
  );

  const content = document.createElement("div");
  content.className = "task-content";

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("time");
  meta.className = "task-meta";
  meta.dateTime = new Date(task.createdAt).toISOString();

  meta.textContent = task.completed
    ? "Completed"
    : `Added ${formatTaskDate(task.createdAt)}`;

  content.append(title, meta);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "icon-button";
  deleteButton.dataset.action = "delete";
  deleteButton.textContent = "×";
  deleteButton.title = "Delete task";

  deleteButton.setAttribute(
    "aria-label",
    `Delete task: ${task.title}`
  );

  article.append(checkbox, content, deleteButton);

  return article;
}

// Show a useful message when a filter has no matching tasks.
function renderEmptyState() {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";

  const icon = document.createElement("div");
  icon.className = "empty-icon";
  icon.textContent = activeFilter === "completed" ? "✓" : "+";

  const heading = document.createElement("h3");
  const description = document.createElement("p");

  if (activeFilter === "completed") {
    heading.textContent = "Nothing completed yet";
    description.textContent =
      "Completed tasks will appear here when you check them off.";
  } else if (activeFilter === "active") {
    heading.textContent = "You're all caught up";
    description.textContent =
      "There are no active tasks. Add a task whenever you're ready.";
  } else {
    heading.textContent = "Start with one task";
    description.textContent =
      "Add something you want to accomplish and build momentum.";
  }

  wrapper.append(icon, heading, description);

  return wrapper;
}

// Keep the remaining count and task summary up to date.
function updateStatistics() {
  const total = tasks.length;
  const remaining = tasks.filter((task) => !task.completed).length;
  const completed = total - remaining;

  elements.remainingCount.textContent =
    remaining === 1 ? "1 task" : `${remaining} tasks`;

  elements.filterAllCount.textContent = total;
  elements.clearCompleted.disabled = completed === 0;

  if (total === 0) {
    elements.listSummary.textContent = "No tasks yet";
  } else if (remaining === 0) {
    elements.listSummary.textContent = "All tasks completed";
  } else if (completed === 0) {
    elements.listSummary.textContent =
      total === 1 ? "1 task in your list" : `${total} tasks in your list`;
  } else {
    elements.listSummary.textContent =
      `${completed} completed · ${remaining} remaining`;
  }
}

// Rebuild the visible task list from the array.
function render() {
  const fragment = document.createDocumentFragment();
  const visibleTasks = getVisibleTasks();

  if (visibleTasks.length === 0) {
    fragment.append(renderEmptyState());
  } else {
    visibleTasks.forEach((task) => {
      fragment.append(createTaskElement(task));
    });
  }

  elements.taskList.replaceChildren(fragment);

  elements.filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === activeFilter;

    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  updateStatistics();
}

// Handle filter selection through event delegation.
function handleFilterClick(event) {
  const button = event.target.closest("[data-filter]");

  if (!button || !elements.filterGroup.contains(button)) {
    return;
  }

  activeFilter = button.dataset.filter;
  render();
}

// Handle delete button clicks with one list listener.
function handleTaskClick(event) {
  const button = event.target.closest('button[data-action="delete"]');

  if (!button || !elements.taskList.contains(button)) {
    return;
  }

  const taskItem = button.closest(".task-item");
  const id = taskItem?.dataset.id;

  if (id) {
    deleteTask(id);
  }
}

// Handle checkbox changes with event delegation.
function handleTaskChange(event) {
  const checkbox = event.target;

  if (!checkbox.matches('input[data-action="toggle"]')) {
    return;
  }

  const taskItem = checkbox.closest(".task-item");
  const id = taskItem?.dataset.id;

  if (id) {
    toggleTask(id);
  }
}

// Confirm before clearing completed tasks.
function clearCompletedTasks() {
  const completedCount = tasks.filter((task) => task.completed).length;

  if (completedCount === 0) {
    return;
  }

  if (typeof elements.confirmDialog.showModal !== "function") {
    if (window.confirm(`Delete ${completedCount} completed tasks?`)) {
      removeCompletedTasks();
    }

    return;
  }

  elements.confirmDialog.showModal();
}

// Remove completed tasks and save the updated list.
function removeCompletedTasks() {
  tasks = tasks.filter((task) => !task.completed);

  commitChanges("Completed tasks cleared.");
}

// Register application event listeners.
elements.form.addEventListener("submit", handleFormSubmit);

elements.taskList.addEventListener("click", handleTaskClick);
elements.taskList.addEventListener("change", handleTaskChange);

elements.filterGroup.addEventListener("click", handleFilterClick);
elements.clearCompleted.addEventListener("click", clearCompletedTasks);

elements.confirmDialog.addEventListener("close", () => {
  if (elements.confirmDialog.returnValue === "confirm") {
    removeCompletedTasks();
  }
});

// Start the application.
updateDate();
render();
