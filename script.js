
const STORAGE_KEY = "bhRefundRecords_v1";

const $ = id => document.getElementById(id);
let editingId = null;

function money(amount) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(Number(amount) || 0);
}

function getRecords() {
    try {
        const records = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );
        return Array.isArray(records) ? records : [];
    } catch {
        return [];
    }
}

function setMessage(text, error = false) {
    $("message").textContent = text;
    $("message").style.color = error ? "#b42318" : "#067647";
}

function addCharge(description = "", amount = 0) {
    const row = document.createElement("tr");

    const descriptionCell = document.createElement("td");
    const descriptionInput = document.createElement("input");

    descriptionInput.type = "text";
    descriptionInput.className = "charge-description";
    descriptionInput.placeholder = "Charge description";
    descriptionInput.value = description;

    descriptionCell.appendChild(descriptionInput);

    const amountCell = document.createElement("td");
    const amountInput = document.createElement("input");

    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "0.01";
    amountInput.placeholder = "0.00";
    amountInput.value = amount || "";
    amountInput.className = "amount-input charge-amount";

    amountInput.addEventListener("input", calculateTotals);
    amountCell.appendChild(amountInput);

    const actionCell = document.createElement("td");
    actionCell.className = "no-print";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.className = "remove-button";

    removeButton.addEventListener("click", () => {
        row.remove();
        calculateTotals();
    });

    actionCell.appendChild(removeButton);
    row.append(descriptionCell, amountCell, actionCell);

    $("chargesBody").appendChild(row);

    descriptionInput.addEventListener("input", calculateTotals);

    calculateTotals();
}

function readForm() {
    const charges = [
        ...document.querySelectorAll("#chargesBody tr")
    ].map(row => ({
        description:
            row.querySelector(".charge-description").value.trim(),
        amount: Math.max(
            0,
            Number(row.querySelector(".charge-amount").value) || 0
        )
    })).filter(item => item.description || item.amount > 0);

    const deposit = Math.max(0, Number($("deposit").value) || 0);

    const totalDeductions = charges.reduce(
        (total, charge) => total + charge.amount, 0
    );

    return {
        id: editingId || (
            crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now())
        ),
        tenantName: $("tenantName").value.trim(),
        boardingHouse: $("boardingHouse").value.trim(),
        roomNumber: $("roomNumber").value.trim(),
        checkoutDate: $("checkoutDate").value,
        checkoutTime: $("checkoutTime").value,
        refundStatus: $("refundStatus").value,
        deposit,
        charges,
        totalDeductions,
        refund: Math.max(0, deposit - totalDeductions),
        extraBalance: Math.max(0, totalDeductions - deposit),
        notes: $("notes").value.trim()
    };
}

function calculateTotals() {
    const data = readForm();

    $("depositTotal").textContent = money(data.deposit);
    $("deductionTotal").textContent =
        "−" + money(data.totalDeductions);
    $("refundTotal").textContent = money(data.refund);
    $("owedTotal").textContent = money(data.extraBalance);

    if (data.extraBalance > 0) {
        $("balanceNote").textContent =
            "Deductions exceed the deposit. Check the remaining balance.";
    } else {
        $("balanceNote").textContent =
            "Final refund = deposit minus total deductions.";
    }
}

function saveRecord() {
    const data = readForm();

    if (!data.tenantName) {
        setMessage("Please enter the tenant's full name.", true);
        $("tenantName").focus();
        return;
    }

    if (!data.boardingHouse) {
        setMessage("Please enter the boarding house name.", true);
        $("boardingHouse").focus();
        return;
    }

    const records = getRecords();
    const index = records.findIndex(record => record.id === data.id);

    if (index >= 0) {
        records[index] = data;
    } else {
        records.unshift(data);
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        renderRecords();

        setMessage(index >= 0
            ? "Refund record updated successfully."
            : "Refund record saved successfully."
        );
    } catch {
        setMessage(
            "Unable to save. Export a backup and check browser storage.",
            true
        );
    }
}

function renderRecords() {
    const tbody = $("recordsBody");
    tbody.innerHTML = "";

    const records = getRecords();

    if (!records.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.textContent = "No saved refund records yet.";
        cell.className = "empty-row";

        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    records.forEach(record => {
        const row = document.createElement("tr");

        const values = [
            record.tenantName || "—",
            [record.roomNumber, record.boardingHouse]
                .filter(Boolean).join(" · ") || "—",
            record.checkoutDate || "—",
            money(record.deposit),
            money(record.totalDeductions),
            money(record.refund),
            record.refundStatus || "Draft"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        actionCell.className = "no-print";

        const actionBox = document.createElement("div");
        actionBox.className = "record-actions";

        const openButton = document.createElement("button");
        openButton.textContent = "Open";
        openButton.type = "button";
        openButton.addEventListener("click", () => loadRecord(record));

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.type = "button";
        deleteButton.className = "delete-one";

        deleteButton.addEventListener("click", () => {
            if (!confirm(
                "Delete the refund record for " +
                record.tenantName + "?"
            )) return;

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    getRecords().filter(item => item.id !== record.id)
                )
            );

            if (editingId === record.id) resetForm();

            renderRecords();
            setMessage("Refund record deleted.");
        });

        actionBox.append(openButton, deleteButton);
        actionCell.appendChild(actionBox);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    });
}

function loadRecord(record) {
    editingId = record.id;

    $("tenantName").value = record.tenantName || "";
    $("boardingHouse").value = record.boardingHouse || "";
    $("roomNumber").value = record.roomNumber || "";
    $("checkoutDate").value = record.checkoutDate || "";
    $("checkoutTime").value = record.checkoutTime || "";
    $("refundStatus").value = record.refundStatus || "Draft";
    $("deposit").value = record.deposit || "";
    $("notes").value = record.notes || "";

    $("chargesBody").innerHTML = "";

    (record.charges || []).forEach(charge => {
        addCharge(charge.description, charge.amount);
    });

    if (!record.charges || !record.charges.length) {
        addCharge();
    }

    calculateTotals();
    setMessage("Record opened. Save changes to update it.");

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
    editingId = null;

    [
        "tenantName",
        "boardingHouse",
        "roomNumber",
        "checkoutDate",
        "checkoutTime",
        "deposit",
        "notes"
    ].forEach(id => $(id).value = "");

    $("refundStatus").value = "Draft";
    $("chargesBody").innerHTML = "";

    addCharge();
    calculateTotals();
    setMessage("Ready for a new refund record.");
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

function exportCsv() {
    const records = getRecords();

    if (!records.length) {
        setMessage("There are no records to export.", true);
        return;
    }

    const headers = [
        "Tenant", "Boarding House", "Room",
        "Checkout Date", "Checkout Time", "Status",
        "Deposit", "Deductions", "Refund",
        "Extra Balance", "Charges", "Notes"
    ];

    const escapeCsv = value =>
        '"' + String(value ?? "").replace(/"/g, '""') + '"';

    const rows = records.map(record => [
        record.tenantName,
        record.boardingHouse,
        record.roomNumber,
        record.checkoutDate,
        record.checkoutTime,
        record.refundStatus,
        record.deposit,
        record.totalDeductions,
        record.refund,
        record.extraBalance,
        (record.charges || []).map(charge =>
            charge.description + ": PHP " + charge.amount
        ).join("; "),
        record.notes
    ].map(escapeCsv).join(","));

    downloadFile(
        [headers.map(escapeCsv).join(","), ...rows].join("\r\n"),
        "boarding-house-refunds.csv",
        "text/csv;charset=utf-8;"
    );

    setMessage("CSV backup exported.");
}

function exportJson() {
    downloadFile(
        JSON.stringify(getRecords(), null, 2),
        "refund-backup.json",
        "application/json"
    );

    setMessage("JSON backup downloaded.");
}

function importJson(file) {
    const reader = new FileReader();

    reader.onload = () => {
        try {
            const imported = JSON.parse(reader.result);

            if (!Array.isArray(imported)) {
                throw new Error("Invalid backup file.");
            }

            const existing = getRecords();
            const records = new Map(
                existing.map(record => [record.id, record])
            );

            imported.forEach((record, index) => {
                if (!record || typeof record !== "object") return;

                if (!record.id) {
                    record.id = "import-" + Date.now() + "-" + index;
                }

                if (!Array.isArray(record.charges)) {
                    record.charges = [];
                }

                record.deposit = Math.max(
                    0, Number(record.deposit) || 0
                );

                record.totalDeductions = record.charges.reduce(
                    (sum, charge) =>
                        sum + Math.max(0, Number(charge.amount) || 0),
                    0
                );

                record.refund = Math.max(
                    0, record.deposit - record.totalDeductions
                );

                record.extraBalance = Math.max(
                    0, record.totalDeductions - record.deposit
                );

                records.set(record.id, record);
            });

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify([...records.values()])
            );

            renderRecords();
            setMessage("Backup imported successfully.");
        } catch {
            setMessage(
                "Import failed. Please choose a valid JSON backup.",
                true
            );
        }

        $("importJson").value = "";
    };

    reader.readAsText(file);
}

// Buttons
$("addCharge").addEventListener("click", () => addCharge());

document.querySelectorAll("[data-charge]").forEach(button => {
    button.addEventListener("click", () => {
        addCharge(button.dataset.charge);
    });
});

$("deposit").addEventListener("input", calculateTotals);

$("saveRecord").addEventListener("click", saveRecord);

$("newRecord").addEventListener("click", () => {
    if (confirm("Clear the form and start a new record?")) {
        resetForm();
    }
});

$("exportCsv").addEventListener("click", exportCsv);
$("exportJson").addEventListener("click", exportJson);

$("printRecord").addEventListener("click", () => {
    window.print();
});

$("importJson").addEventListener("change", event => {
    if (event.target.files[0]) {
        importJson(event.target.files[0]);
    }
});

$("clearRecords").addEventListener("click", () => {
    if (!confirm(
        "Delete ALL saved records? Export a backup first."
    )) return;

    localStorage.removeItem(STORAGE_KEY);
    editingId = null;
    renderRecords();
    setMessage("All saved records deleted.");
});

$("todayDate").textContent = new Date().toLocaleDateString(
    "en-PH",
    { year: "numeric", month: "short", day: "numeric" }
);

addCharge();
renderRecords();
calculateTotals();
