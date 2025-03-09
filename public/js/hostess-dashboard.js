document.addEventListener('DOMContentLoaded', () => {
    const socket = io({
        transports: ['websocket']
    });

    console.log('Socket.io initialized');

    // Emit joinEvent with a dummy event filename for testing
    const urlParams = new URLSearchParams(window.location.search);
    const eventFilename = urlParams.get('event');
    socket.emit('joinEvent', eventFilename);
    console.log('joinEvent emitted:', eventFilename);

    
    function updateArrivedCount() {
        const arrivedCount = document.querySelectorAll('.arrived-checkbox:checked').length;
        const arrivedCountElement = document.getElementById('arrived-count');
        if (arrivedCountElement) {
            arrivedCountElement.textContent = arrivedCount;
        }
    }

    // Initial data load
    socket.on('initialData', (data) => {
        console.log('Received initial data:', data);
        updateGuestList(data.guests);
        updateArrivedCount();
    });

    // Handle guest update from server
    socket.on('guestUpdated', (updatedGuest) => {
        console.log('Received guest update:', updatedGuest);
        const checkbox = document.getElementById(`checkbox-${updatedGuest.index}`);
        if (checkbox) {
            checkbox.checked = updatedGuest.arrived;
            updateArrivedCount();
        }
    });

    // Function to attach event listeners to checkboxes
    function attachCheckboxEvents() {
        const checkboxes = document.querySelectorAll('.arrived-checkbox');
        checkboxes.forEach((checkbox, index) => {
            checkbox.addEventListener('change', () => {
                const arrived = checkbox.checked;
                console.log('Checkbox change event emitted', { index, arrived });
                socket.emit('checkboxChange', { index, arrived });
                updateArrivedCount();
            });
        });
    }

    // Function to update guest list in the UI
    function updateGuestList(guests) {
        const guestList = document.getElementById('guest-list');
        if (guestList) {
            const tbody = guestList.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = '';
                guests.forEach((guest, index) => {
                    const row = document.createElement('tr');
                    row.setAttribute('data-id', index);
                    
                    const nameCell = document.createElement('td');
                    nameCell.textContent = guest.name;
                    
                    const tableCell = document.createElement('td');
                    tableCell.textContent = guest.tableNumber;
                    
                    const arrivedCell = document.createElement('td');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'arrived-checkbox';
                    checkbox.id = `checkbox-${index}`;
                    checkbox.checked = guest.arrived;
                    
                    arrivedCell.appendChild(checkbox);
                    
                    row.appendChild(nameCell);
                    row.appendChild(tableCell);
                    row.appendChild(arrivedCell);
                    
                    tbody.appendChild(row);
                });
                
                attachCheckboxEvents(); // Attach events after updating guest list
                updateArrivedCount(); // Update count after rendering
            }
        }
    }

    // Sorting functionality
    const tableHeaders = document.querySelectorAll('th[data-sort]');
    tableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortProperty = header.getAttribute('data-sort');
            let currentOrder = header.getAttribute('data-order');
            const newOrder = (currentOrder === 'asc') ? 'desc' : 'asc';

            tableHeaders.forEach(th => th.removeAttribute('data-order'));
            header.setAttribute('data-order', newOrder);

            sortGuests(sortProperty, newOrder);
        });
    });

    function sortGuests(property, order) {
        const rows = Array.from(document.querySelectorAll('#guest-list tbody tr'));
        const sortedRows = rows.sort((a, b) => {
            const aValue = getValue(a, property);
            const bValue = getValue(b, property);

            if (order === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        });

        const guestList = document.getElementById('guest-list').querySelector('tbody');
        sortedRows.forEach(row => guestList.appendChild(row));
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
                const checkbox = cell.querySelector('.arrived-checkbox');
                value = checkbox.checked ? '1' : '0'; // Convert boolean to sortable string
            }
        });

        return value;
    }

    const filterNameInput = document.getElementById('filter-name');
    if (filterNameInput) {
        filterNameInput.addEventListener('input', () => {
            filterGuests();
        });
    }

    const filterTableInput = document.getElementById('filter-table');
    if (filterTableInput) {
        filterTableInput.addEventListener('input', () => {
            filterGuests();
        });
    }

    // Function to filter guests based on input values
    function filterGuests() {
        const filterValue = filterNameInput.value.toLowerCase();
        const filterTable = filterTableInput.value.toLowerCase();
        const rows = document.querySelectorAll('#guest-list tbody tr');
        rows.forEach((row) => {
            const name = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
            const table = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
            if (name.includes(filterValue) && table.includes(filterTable)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
});
