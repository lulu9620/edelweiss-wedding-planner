document.addEventListener("DOMContentLoaded", () => {
  const socket = io({
    transports: ["websocket"],
  });

  console.log("Socket.io initialized");

  // Emit joinEvent with a dummy event filename for testing
  const urlParams = new URLSearchParams(window.location.search);
  const eventFilename = urlParams.get("event");
  socket.emit("joinEvent", eventFilename);
  console.log("joinEvent emitted:", eventFilename);

  // Update the arrived count function to use status elements instead of checkboxes
  function updateArrivedCount() {
    const arrivedCount = document.querySelectorAll('.guest-status.guest-arrived').length;
    const arrivedCountElement = document.getElementById('arrived-count');
    if (arrivedCountElement) {
        arrivedCountElement.textContent = arrivedCount;
    }
  }
  
  // Initial data load
  socket.on("initialData", (data) => {
    console.log("Received initial data:", data);
    updateGuestList(data.guests);
    updateArrivedCount();
  });

  // Handle guest update from server
  socket.on('guestUpdated', (updatedGuest) => {
    console.log('Received guest update:', updatedGuest);
    
    // Update the status display
    const statusElement = document.querySelector(`[data-guest-index="${updatedGuest.index}"]`);
    if (statusElement) {
        statusElement.textContent = updatedGuest.arrived ? 'Prezent' : 'Așteptare';
        statusElement.className = updatedGuest.arrived ? 'guest-status guest-arrived' : 'guest-status guest-waiting';
        statusElement.setAttribute('data-guest-status', updatedGuest.arrived);
        
        // Update the button status attribute
        const statusButton = document.querySelector(`button[data-guest-id="${updatedGuest.index}"]`);
        if (statusButton) {
            statusButton.setAttribute('data-guest-status', updatedGuest.arrived);
        }
        
        updateArrivedCount();
    }
  });

  // Function to attach event listeners to checkboxes
  function attachCheckboxEvents() {
    const checkboxes = document.querySelectorAll(".arrived-checkbox");
    checkboxes.forEach((checkbox, index) => {
      checkbox.addEventListener("change", () => {
        const arrived = checkbox.checked;
        console.log("Checkbox change event emitted", { index, arrived });
        socket.emit("checkboxChange", { index, arrived });
        updateArrivedCount();
      });
    });
  }

  // Function to update guest list in the UI
  function updateGuestList(guests) {
    const guestList = document.getElementById("guest-list");
    if (!guestList) return;

    const tbody = guestList.querySelector("tbody");
    if (!tbody) return;

    // Keep a reference to existing states
    const existingStatus = {};
    document.querySelectorAll("[data-guest-status]").forEach((element) => {
      const index = element.getAttribute("data-guest-index");
      existingStatus[index] =
        element.getAttribute("data-guest-status") === "true";
    });

    // Clear current content
    tbody.innerHTML = "";

    // Populate with updated data
    guests.forEach((guest, index) => {
      const row = document.createElement("tr");
      row.setAttribute("data-id", index);

      // Name cell
      const nameCell = document.createElement("td");
      nameCell.textContent = guest.name || "";
      row.appendChild(nameCell);

      // Table cell
      const tableCell = document.createElement("td");
      tableCell.textContent = guest.tableNumber || "";
      row.appendChild(tableCell);

      // Status cell - Replace checkbox with text
      const statusCell = document.createElement("td");

      // Determine guest status (use existing if available)
      const isArrived =
        existingStatus[index] !== undefined
          ? existingStatus[index]
          : guest.arrived || false;

      // Create status indicator
      const statusSpan = document.createElement("span");
      statusSpan.setAttribute("data-guest-index", index);
      statusSpan.setAttribute("data-guest-status", isArrived);
      statusSpan.className = isArrived
        ? "guest-status guest-arrived"
        : "guest-status guest-waiting";
      statusSpan.textContent = isArrived ? "Prezent" : "Așteptare";

      statusCell.appendChild(statusSpan);
      row.appendChild(statusCell);

      // Status button cell
      const actionCell = document.createElement("td");
      const statusButton = document.createElement("button");
      statusButton.className = "btn btn-sm btn-outline-secondary";
      statusButton.type = "button";
      statusButton.setAttribute("data-bs-toggle", "modal");
      statusButton.setAttribute("data-bs-target", "#statusModal");
      statusButton.setAttribute("data-guest-id", index);
      statusButton.setAttribute("data-guest-name", guest.name || "");
      statusButton.setAttribute("data-guest-status", isArrived);

      // Add icon to button
      const icon = document.createElement("i");
      icon.className = "bi bi-three-dots-vertical three-dots-vertical";
      statusButton.appendChild(icon);

      // Add text to button
      const textNode = document.createTextNode("");
      statusButton.appendChild(textNode);

      actionCell.appendChild(statusButton);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });

    updateArrivedCount();
  }

  // Sorting functionality
  const tableHeaders = document.querySelectorAll("th[data-sort]");
  tableHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const sortProperty = header.getAttribute("data-sort");
      let currentOrder = header.getAttribute("data-order");
      const newOrder = currentOrder === "asc" ? "desc" : "asc";

      tableHeaders.forEach((th) => th.removeAttribute("data-order"));
      header.setAttribute("data-order", newOrder);

      sortGuests(sortProperty, newOrder);
    });
  });

  function sortGuests(property, order) {
    const rows = Array.from(document.querySelectorAll("#guest-list tbody tr"));
    const sortedRows = rows.sort((a, b) => {
      const aValue = getValue(a, property);
      const bValue = getValue(b, property);

      if (order === "asc") {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    const guestList = document
      .getElementById("guest-list")
      .querySelector("tbody");
    sortedRows.forEach((row) => guestList.appendChild(row));
  }

  function getValue(row, property) {
    let value = '';
    const cells = row.querySelectorAll('td');

    cells.forEach((cell, index) => {
        if (property === 'name' && index === 0) {
            value = cell.textContent.trim().toLowerCase();
        } else if (property === 'tableNumber' && index === 1) {
            value = cell.textContent.trim().toLowerCase();
        } else if (property === 'arrived' && index === 2) {
            // Get status from data attribute
            const statusSpan = cell.querySelector('.guest-status');
            value = statusSpan.getAttribute('data-guest-status') === 'true' ? '1' : '0';
        }
    });

    return value;
  }

  const filterNameInput = document.getElementById("filter-name");
  if (filterNameInput) {
    filterNameInput.addEventListener("input", () => {
      filterGuests();
    });
  }

  const filterTableInput = document.getElementById("filter-table");
  if (filterTableInput) {
    filterTableInput.addEventListener("input", () => {
      filterGuests();
    });
  }

  // Function to filter guests based on input values
  function filterGuests() {
    const filterValue = filterNameInput.value.toLowerCase();
    const filterTable = filterTableInput.value.toLowerCase();
    const rows = document.querySelectorAll("#guest-list tbody tr");
    rows.forEach((row) => {
      const name = row
        .querySelector("td:nth-child(1)")
        .textContent.toLowerCase();
      const table = row
        .querySelector("td:nth-child(2)")
        .textContent.toLowerCase();
      if (name.includes(filterValue) && table.includes(filterTable)) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  }

  // REMOVE THIS NESTED EVENT LISTENER - It's causing the problem
  // document.addEventListener("DOMContentLoaded", function () { ... });

  // Instead, put the modal code directly here:
  let currentGuestId = null;

  // When the modal is about to be shown
  const statusModal = document.getElementById("statusModal");
  if (statusModal) {
    statusModal.addEventListener("show.bs.modal", function (event) {
      // Button that triggered the modal
      const button = event.relatedTarget;

      // Extract info from data attributes
      currentGuestId = button.getAttribute("data-guest-id");
      const guestName = button.getAttribute("data-guest-name");
      const currentStatus = button.getAttribute("data-guest-status") === "true";

      // Update the modal content
      document.getElementById("guestNameDisplay").textContent = guestName;

      // Set the current status
      if (currentStatus) {
        document.getElementById("statusPresent").checked = true;
      } else {
        document.getElementById("statusAbsent").checked = true;
      }
    });
  }

  // When save button is clicked
  const saveStatusButton = document.getElementById("saveStatusButton");
  if (saveStatusButton) {
    saveStatusButton.addEventListener("click", function () {
      if (currentGuestId !== null) {
        const newStatus = document.getElementById("statusPresent").checked;

        // Update status via socket
        socket.emit("checkboxChange", {
          index: parseInt(currentGuestId),
          arrived: newStatus,
        });

        // Update the status display
        const statusElement = document.querySelector(
          `[data-guest-index="${currentGuestId}"]`
        );
        if (statusElement) {
          statusElement.textContent = newStatus ? "Prezent" : "Așteptare";
          statusElement.className = newStatus
            ? "guest-status guest-arrived"
            : "guest-status guest-waiting";
          statusElement.setAttribute("data-guest-status", newStatus);
        }

        // Update the button status attribute
        const statusButton = document.querySelector(
          `button[data-guest-id="${currentGuestId}"]`
        );
        if (statusButton) {
          statusButton.setAttribute("data-guest-status", newStatus);
        }

        // Close the modal
        const modal = bootstrap.Modal.getInstance(statusModal);
        modal.hide();

        // Update arrived count
        updateArrivedCount();
      }
    });
  }
});
