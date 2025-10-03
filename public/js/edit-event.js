// public/js/edit-event.js
document.addEventListener('DOMContentLoaded', function() {
    const guestListTable = document.getElementById('guest-list').getElementsByTagName('tbody')[0];
    const addRowButton = document.getElementById('add-row');
    const eventForm = document.getElementById('event-form');
    const filterNameInput = document.getElementById('filter-name');
    const filterTableInput = document.getElementById('filter-table');
    const tableHeaders = document.querySelectorAll('#guest-list thead th[data-sort]');

    let guests = [];
    let originalGuests = []; // Store original guest data to preserve arrived status

    function updateGuestListData() {
        const rows = guestListTable.rows;
        // Create a map of current visible guests with their updated data
        const visibleGuestsMap = new Map();
        const newGuests = [];
        
        for (let i = 0; i < rows.length; i++) {
            const nameInput = rows[i].querySelector('input[name="guest-name"]');
            const tableInput = rows[i].querySelector('input[name="guest-table"]');
            
            if (nameInput && tableInput) {
                const originalName = nameInput.getAttribute('data-original-name');
                const currentName = nameInput.value;
                const tableNumber = tableInput.value;
                
                if (originalName === '' || originalName === null) {
                    // This is a new guest
                    if (currentName.trim() !== '' || tableNumber.trim() !== '') {
                        newGuests.push({
                            name: currentName,
                            tableNumber: tableNumber,
                            arrived: false
                        });
                    }
                } else {
                    // This is an existing guest
                    visibleGuestsMap.set(originalName, {
                        name: currentName,
                        tableNumber: tableNumber
                    });
                }
            }
        }
        
        // Update guests array by merging with visible changes, preserving all guests
        guests = guests.map(guest => {
            // Check if this guest was modified in the visible list
            const visibleGuest = visibleGuestsMap.get(guest.name);
            if (visibleGuest) {
                return {
                    ...guest,
                    name: visibleGuest.name,
                    tableNumber: visibleGuest.tableNumber
                };
            }
            return guest; // Keep original guest data if not visible/modified
        });
        
        // Add any new guests
        guests.push(...newGuests);
    }

    function renderGuestList(filteredGuests = guests) {
        guestListTable.innerHTML = '';
        filteredGuests.forEach(guest => {
            const newRow = guestListTable.insertRow();
            const nameCell = newRow.insertCell(0);
            const tableCell = newRow.insertCell(1);
            const actionsCell = newRow.insertCell(2);

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.name = 'guest-name';
            nameInput.value = guest.name;
            nameInput.className = 'col-5';
            nameInput.setAttribute('data-original-name', guest.name); // Track original name for mapping
            
            nameCell.appendChild(nameInput);
            tableCell.innerHTML = `<input type="number" name="guest-table" value="${guest.tableNumber}" class="col-5">`;
            actionsCell.innerHTML = '<button class="dropdown-item text-warning delete-row font-size-12" type="button"> <i class="bi bi-trash me-2"></i></button>';
        
            attachRowListeners(newRow);
        });
    }

    function filterGuests() {
        const nameFilter = filterNameInput.value.toLowerCase();
        const tableFilter = filterTableInput.value;
        const filteredGuests = guests.filter(guest => {
            const matchesName = guest.name.toLowerCase().includes(nameFilter);
            const matchesTable = guest.tableNumber.toLowerCase().includes(tableFilter);
            return matchesName && matchesTable;
        });
        renderGuestList(filteredGuests);
    }
    
    function sortGuests(property, order) {
        guests.sort((a, b) => {
            const varA = (typeof a[property] === 'string') ? a[property].toUpperCase() : a[property];
            const varB = (typeof b[property] === 'string') ? b[property].toUpperCase() : b[property];
            let comparison = 0;
            if (varA > varB) {
                comparison = 1;
            } else if (varA < varB) {
                comparison = -1;
            }
            return (order === 'asc') ? comparison : (comparison * -1);
        });
        renderGuestList();
    }

    addRowButton.addEventListener('click', () => {
        const newRow = guestListTable.insertRow();
        const nameCell = newRow.insertCell(0);
        const tableCell = newRow.insertCell(1);
        const actionsCell = newRow.insertCell(2);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.name = 'guest-name';
        nameInput.className = 'col-5';
        nameInput.setAttribute('data-original-name', ''); // Empty original name for new guests
        
        nameCell.appendChild(nameInput);
        tableCell.innerHTML = '<input type="number" name="guest-table" class="col-5">';
        actionsCell.innerHTML = '<button class="dropdown-item text-warning delete-row font-size-12" type="button"> <i class="bi bi-trash me-2"></i></button>';

        // Insert at the beginning of the table body
        if (guestListTable.firstChild) {
            guestListTable.insertBefore(newRow, guestListTable.firstChild);
        } else {
            guestListTable.appendChild(newRow);
        }

        attachRowListeners(newRow);
        nameInput.focus();
    });

    eventForm.addEventListener('submit', (event) => {
        event.preventDefault();
        updateGuestListData();
        document.getElementById('guest-list-data').value = JSON.stringify(guests);
        eventForm.submit();
    });

    filterNameInput.addEventListener('input', filterGuests);
    filterTableInput.addEventListener('input', filterGuests);

    tableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortProperty = header.getAttribute('data-sort');
            const currentOrder = header.getAttribute('data-order');
            const newOrder = (currentOrder === 'asc') ? 'desc' : 'asc';

            tableHeaders.forEach(th => th.removeAttribute('data-order'));
            header.setAttribute('data-order', newOrder);

            sortGuests(sortProperty, newOrder);
        });
    });

    function attachRowListeners(row) {
        row.querySelector('.delete-row').addEventListener('click', () => {
            const nameInput = row.querySelector('input[name="guest-name"]');
            const originalName = nameInput.getAttribute('data-original-name');
            
            if (originalName && originalName !== '') {
                // Remove from the complete guests array if it's an existing guest
                guests = guests.filter(guest => guest.name !== originalName);
            }
            
            // Remove the row from DOM
            row.remove();
            
            // Re-apply current filters if needed
            if (filterNameInput.value || filterTableInput.value) {
                filterGuests();
            }
        });
    }

    Array.from(guestListTable.rows).forEach(row => {
        attachRowListeners(row);
    });

    // Initialize original guest data from the existing table
    function initializeOriginalGuests() {
        originalGuests = [];
        guests = [];
        const rows = guestListTable.rows;
        for (let i = 0; i < rows.length; i++) {
            const nameInput = rows[i].querySelector('input[name="guest-name"]');
            const tableInput = rows[i].querySelector('input[name="guest-table"]');
            const row = rows[i];
            
            if (nameInput && tableInput) {
                // Check if the row has data-arrived attribute or use a default
                const arrived = row.dataset.arrived === 'true' || false;
                
                const guestData = {
                    name: nameInput.value,
                    tableNumber: tableInput.value,
                    arrived: arrived
                };
                
                // Set the data-original-name attribute for existing inputs
                nameInput.setAttribute('data-original-name', nameInput.value);
                
                originalGuests.push(guestData);
                guests.push(guestData);
            }
        }
    }

    // Initialize original guests and current guests
    initializeOriginalGuests();
});
