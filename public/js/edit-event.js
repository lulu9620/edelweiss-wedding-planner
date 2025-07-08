// public/js/edit-event.js
document.addEventListener('DOMContentLoaded', function() {
    const guestListTable = document.getElementById('guest-list').getElementsByTagName('tbody')[0];
    const addRowButton = document.getElementById('add-row');
    const eventForm = document.getElementById('event-form');
    const filterNameInput = document.getElementById('filter-name');
    const filterTableInput = document.getElementById('filter-table');
    const tableHeaders = document.querySelectorAll('#guest-list thead th[data-sort]');

    let guests = [];

    function updateGuestListData() {
        const rows = guestListTable.rows;
        guests = [];
        for (let i = 0; i < rows.length; i++) {
            const name = rows[i].querySelector('input[name="guest-name"]').value;
            const tableNumber = rows[i].querySelector('input[name="guest-table"]').value;
            guests.push({ name, tableNumber, arrived: false });
        }
    }

    function renderGuestList(filteredGuests = guests) {
        guestListTable.innerHTML = '';
        filteredGuests.forEach(guest => {
            const newRow = guestListTable.insertRow();
            const nameCell = newRow.insertCell(0);
            const tableCell = newRow.insertCell(1);
            const actionsCell = newRow.insertCell(2);

            nameCell.innerHTML = `<input type="text" name="guest-name" value="${guest.name}" class="col-5">`;
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

        nameCell.innerHTML = '<input type="text" name="guest-name" class="col-5">';
        tableCell.innerHTML = '<input type="number" name="guest-table" class="col-5">';
        actionsCell.innerHTML = '<button class="dropdown-item text-warning delete-row font-size-12" type="button"> <i class="bi bi-trash me-2"></i></button>';

        // Insert at the beginning of the table body
        if (guestListTable.firstChild) {
            guestListTable.insertBefore(newRow, guestListTable.firstChild);
        } else {
            guestListTable.appendChild(newRow);
        }

        attachRowListeners(newRow);
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
            row.remove();
            updateGuestListData();
            filterGuests();
        });
    }

    Array.from(guestListTable.rows).forEach(row => {
        attachRowListeners(row);
    });

    updateGuestListData();
});
