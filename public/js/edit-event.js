document.addEventListener('DOMContentLoaded', function() {
    const guestListTable = document.getElementById('guest-list').getElementsByTagName('tbody')[0];
    const addRowButton = document.getElementById('add-row');
    const eventForm = document.getElementById('event-form');
    const filterNameInput = document.getElementById('filter-name');
    const filterTableInput = document.getElementById('filter-table');
    const tableHeaders = document.querySelectorAll('#guest-list thead th[data-sort]');

    let guests = [];
    let originalGuests = [];

    function generateId() {
        return '_' + Math.random().toString(36).slice(2, 11); // ID unic
    }

    function updateGuestListData() {
        const rows = guestListTable.rows;
        const updatedGuests = [];
        
        for (let i = 0; i < rows.length; i++) {
            const nameInput = rows[i].querySelector('input[name="guest-name"]');
            const tableInput = rows[i].querySelector('input[name="guest-table"]');
            
            if (nameInput && tableInput) {
                const id = nameInput.getAttribute('data-id');
                const currentName = nameInput.value.trim();
                const tableNumber = tableInput.value.trim();
                
                if (currentName !== '' || tableNumber !== '') {
                    let existingGuest = guests.find(g => g.id === id);
                    if (existingGuest) {
                        // actualizare guest existent
                        existingGuest.name = currentName;
                        existingGuest.tableNumber = tableNumber;
                        updatedGuests.push(existingGuest);
                    } else {
                        // guest nou
                        updatedGuests.push({
                            id: id || generateId(),
                            name: currentName,
                            tableNumber: tableNumber,
                            arrived: false
                        });
                    }
                }
            }
        }
        
        guests = updatedGuests;
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
            nameInput.setAttribute('data-id', guest.id);
            
            nameCell.appendChild(nameInput);
            tableCell.innerHTML = `<input type="number" name="guest-table" value="${guest.tableNumber}" class="col-5">`;
            actionsCell.innerHTML = '<button class="dropdown-item text-warning delete-row font-size-12" type="button"> <i class="bi bi-trash me-2"></i></button>';
        
            attachRowListeners(newRow);
        });
    }

    function filterGuests() {
        const nameFilter = filterNameInput.value.toLowerCase();
        const tableFilter = filterTableInput.value.toLowerCase();
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
        const newId = generateId();
        nameInput.setAttribute('data-id', newId);
        
        nameCell.appendChild(nameInput);
        tableCell.innerHTML = '<input type="number" name="guest-table" class="col-5">';
        actionsCell.innerHTML = '<button class="dropdown-item text-warning delete-row font-size-12" type="button"> <i class="bi bi-trash me-2"></i></button>';

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
            const id = nameInput.getAttribute('data-id');
            guests = guests.filter(guest => guest.id !== id);
            row.remove();
            
            if (filterNameInput.value || filterTableInput.value) {
                filterGuests();
            }
        });
    }

    Array.from(guestListTable.rows).forEach(row => {
        attachRowListeners(row);
    });

    function initializeOriginalGuests() {
        originalGuests = [];
        guests = [];
        const rows = guestListTable.rows;
        for (let i = 0; i < rows.length; i++) {
            const nameInput = rows[i].querySelector('input[name="guest-name"]');
            const tableInput = rows[i].querySelector('input[name="guest-table"]');
            const row = rows[i];
            
            if (nameInput && tableInput) {
                const arrived = row.dataset.arrived === 'true' || false;
                const id = generateId();
                
                const guestData = {
                    id: id,
                    name: nameInput.value,
                    tableNumber: tableInput.value,
                    arrived: arrived
                };
                
                nameInput.setAttribute('data-id', id);
                
                originalGuests.push(guestData);
                guests.push(guestData);
            }
        }
    }

    initializeOriginalGuests();
});
