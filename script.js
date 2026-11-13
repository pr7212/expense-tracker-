/* ==========================================
   BIZZ TRACKER - APPLICATION JAVASCRIPT
   ========================================== */

/* ==========================================
   1. DOM HELPERS
   ========================================== */

// Get an HTML element by its ID.
const $ = (id) => document.getElementById(id);

// Generate unique IDs for application records.
const generateId = () => crypto.randomUUID();

/* ==========================================
   2. DATA PERSISTENCE
   ========================================== */

// Load saved records from localStorage.
function loadData(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Could not load ${key}:`, error);
    return [];
  }
}

// Application data.
let products = loadData('bizz_products');
let sales = loadData('bizz_sales');
let expenses = loadData('bizz_expenses');

// Save all application data.
function saveData() {
  try {
    localStorage.setItem('bizz_products', JSON.stringify(products));
    localStorage.setItem('bizz_sales', JSON.stringify(sales));
    localStorage.setItem('bizz_expenses', JSON.stringify(expenses));

    return true;
  } catch (error) {
    console.error('Could not save application data:', error);
    alert('Your data could not be saved. Check your browser storage.');

    return false;
  }
}

/* ==========================================
   3. UTILITY FUNCTIONS
   ========================================== */

// Format numbers as Kenyan Shillings.
const money = (amount) =>
  `KES ${Number(amount || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Return today's date in YYYY-MM-DD format.
const todayKey = () => {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// Escape user-provided values before inserting them into HTML.
const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]
  );

// Calculate profit using the financial values saved with each sale.
function getSaleProfit(sale) {
  if (
    sale.profit !== undefined &&
    sale.profit !== null &&
    Number.isFinite(Number(sale.profit))
  ) {
    return Number(sale.profit);
  }

  return (
    (Number(sale.unitPrice || 0) - Number(sale.unitCost || 0)) *
    Number(sale.quantity || 0)
  );
}

// Refresh Lucide icons after dynamically updating HTML.
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/* ==========================================
   4. DASHBOARD RENDERING
   ========================================== */

function render() {
  const today = todayKey();

  // Get sales recorded today.
  const todaySales = sales.filter((sale) => sale.date === today);

  // Calculate today's revenue.
  const revenue = todaySales.reduce(
    (sum, sale) => sum + Number(sale.revenue || 0),
    0
  );

  // Calculate today's gross profit.
  const profit = todaySales.reduce((sum, sale) => sum + getSaleProfit(sale), 0);

  // Calculate total available stock.
  const stockCount = products.reduce(
    (sum, product) => sum + Number(product.quantity || 0),
    0
  );

  // Update dashboard statistics.
  if ($('revenue')) {
    $('revenue').textContent = money(revenue);
  }

  if ($('profit')) {
    $('profit').textContent = money(profit);
    $('profit').className = profit < 0 ? 'negative' : 'positive';
  }

  if ($('stock')) {
    $('stock').textContent = stockCount.toLocaleString('en-KE');
  }

  if ($('transactions')) {
    $('transactions').textContent = todaySales.length;
  }

  // Display the current date.
  if ($('today')) {
    $('today').textContent = new Date().toLocaleDateString('en-KE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if ($('salesDate')) {
    $('salesDate').textContent = today;
  }

  // Refresh all application modules.
  renderInventory();
  renderSaleOptions();
  renderSales();
  renderExpenses();
  renderReports();

  refreshIcons();
}

/* ==========================================
   5. INVENTORY MANAGEMENT
   ========================================== */

// Display registered products and their stock levels.
function renderInventory() {
  const inventory = $('inventoryTable');

  if (!inventory) return;

  inventory.innerHTML = products.length
    ? products
        .map((product) => {
          const quantity = Number(product.quantity || 0);
          const minimum = Number(product.min || 0);

          let status = 'Available';

          if (quantity === 0) {
            status = 'Out of stock';
          } else if (quantity <= minimum) {
            status = 'Low stock';
          }

          const isLowStock = quantity <= minimum;

          return `
            <tr>
              <td>${escapeHTML(product.name)}</td>
              <td>${money(product.cost)}</td>
              <td>${money(product.price)}</td>
              <td>${quantity}</td>
              <td>
                <span class="status ${isLowStock ? 'low' : ''}">
                  ${status}
                </span>
              </td>
              <td>
                <button
                  class="danger"
                  type="button"
                  data-action="delete-product"
                  data-id="${escapeHTML(product.id)}"
                >
                  Delete
                </button>
              </td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td colspan="6" class="empty">
          No products added yet.
        </td>
      </tr>
    `;

  // Update the number of products requiring restocking.
  const lowCount = products.filter(
    (product) => Number(product.quantity || 0) <= Number(product.min || 0)
  ).length;

  if ($('lowCount')) {
    $('lowCount').textContent = `${lowCount} low-stock items`;
  }
}

// Populate the sale dropdown with available products.
function renderSaleOptions() {
  const select = $('saleProduct');

  if (!select) return;

  const previousValue = select.value;

  select.innerHTML = `
    <option value="">Select a product</option>
    ${products
      .filter((product) => Number(product.quantity) > 0)
      .map(
        (product) => `
          <option value="${escapeHTML(product.id)}">
            ${escapeHTML(product.name)}
            (${Number(product.quantity)} available)
          </option>
        `
      )
      .join('')}
  `;

  // Preserve the selected product if it is still available.
  if (
    products.some(
      (product) => product.id === previousValue && Number(product.quantity) > 0
    )
  ) {
    select.value = previousValue;
  }
}

// Add a new product.
const productForm = $('productForm');

if (productForm) {
  productForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const name = $('productName').value.trim();
    const cost = Number($('costPrice').value);
    const price = Number($('sellingPrice').value);
    const quantity = Number($('quantity').value);
    const min = Number($('minStock').value);

    // Validate product details.
    if (
      !name ||
      !Number.isFinite(cost) ||
      !Number.isFinite(price) ||
      cost < 0 ||
      price < 0 ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      !Number.isInteger(min) ||
      min < 0
    ) {
      alert('Please enter valid product details.');
      return;
    }

    // Prevent duplicate product names.
    const duplicate = products.some(
      (product) => String(product.name).toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      alert('A product with this name already exists.');
      return;
    }

    const product = {
      id: generateId(),
      name,
      cost,
      price,
      quantity,
      min,
      createdAt: new Date().toISOString(),
    };

    products.push(product);

    if (!saveData()) {
      products.pop();
      return;
    }

    this.reset();

    if ($('minStock')) {
      $('minStock').value = 5;
    }

    render();
    alert('Product added successfully.');
  });
}

// Delete a product only when it has no sales history.
function deleteProduct(id) {
  const product = products.find((item) => item.id === id);

  if (!product) {
    alert('Product not found.');
    return;
  }

  const hasSales = sales.some((sale) => sale.productId === id);

  if (hasSales) {
    alert('This product has sales history. Keep it to preserve your records.');
    return;
  }

  if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) {
    return;
  }

  const previousProducts = products;

  products = products.filter((item) => item.id !== id);

  if (!saveData()) {
    products = previousProducts;
    return;
  }

  render();
}

// Handle inventory deletion using event delegation.
const inventoryTable = $('inventoryTable');

if (inventoryTable) {
  inventoryTable.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="delete-product"]');

    if (!button) return;

    deleteProduct(button.dataset.id);
  });
}

/* ==========================================
   6. SALES MANAGEMENT
   ========================================== */

// Display sales recorded today.
function renderSales() {
  const table = $('salesTable');

  if (!table) return;

  const todaySales = sales
    .filter((sale) => sale.date === todayKey())
    .slice()
    .reverse();

  table.innerHTML = todaySales.length
    ? todaySales
        .map((sale) => {
          const profit = getSaleProfit(sale);

          return `
            <tr>
              <td>${escapeHTML(sale.name)}</td>
              <td>${Number(sale.quantity)}</td>
              <td>${money(sale.revenue)}</td>
              <td class="${profit < 0 ? 'negative' : 'positive'}">
                ${money(profit)}
              </td>
              <td>${escapeHTML(sale.time)}</td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td colspan="5" class="empty">
          No sales recorded today.
        </td>
      </tr>
    `;
}

// Record a new sale.
const saleForm = $('saleForm');

if (saleForm) {
  saleForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const productId = $('saleProduct').value;
    const quantity = Number($('saleQuantity').value);

    const product = products.find((item) => item.id === productId);

    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
      alert('Please select a product and enter a valid quantity.');
      return;
    }

    if (quantity > Number(product.quantity)) {
      alert('Not enough stock available.');
      return;
    }

    // Capture product prices at the time of sale.
    const unitCost = Number(product.cost);
    const unitPrice = Number(product.price);

    const revenue = unitPrice * quantity;
    const profit = (unitPrice - unitCost) * quantity;

    const now = new Date();

    const sale = {
      id: generateId(),
      productId: product.id,
      name: product.name,
      quantity,
      unitCost,
      unitPrice,
      revenue,
      profit,
      date: todayKey(),

      time: now.toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
      }),

      createdAt: now.toISOString(),
    };

    // Update inventory and record the sale.
    product.quantity -= quantity;
    sales.push(sale);

    if (!saveData()) {
      product.quantity += quantity;
      sales.pop();
      return;
    }

    this.reset();

    render();
    alert('Sale recorded successfully.');
  });
}

/* ==========================================
   7. EXPENSE MANAGEMENT
   ========================================== */

// Calculate expense totals and display expense history.
function renderExpenses() {
  const today = todayKey();
  const currentMonth = today.slice(0, 7);

  // Calculate today's expenses.
  const todayTotal = expenses
    .filter((expense) => expense.date === today)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  // Calculate expenses for the current month.
  const monthTotal = expenses
    .filter((expense) => expense.date.startsWith(currentMonth))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  if ($('todayExpenses')) {
    $('todayExpenses').textContent = money(todayTotal);
  }

  if ($('monthExpenses')) {
    $('monthExpenses').textContent = money(monthTotal);
  }

  if ($('expenseCount')) {
    $('expenseCount').textContent = `${expenses.length} expenses`;
  }

  const table = $('expensesTable');

  if (!table) return;

  // Display newest expenses first.
  const sortedExpenses = [...expenses].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );

  table.innerHTML = sortedExpenses.length
    ? sortedExpenses
        .map(
          (expense) => `
            <tr>
              <td>${escapeHTML(expense.title)}</td>
              <td>${escapeHTML(expense.category)}</td>
              <td>${money(expense.amount)}</td>
              <td>${escapeHTML(expense.payment)}</td>
              <td>${escapeHTML(expense.date)}</td>
              <td>
                <button
                  type="button"
                  class="danger"
                  data-action="delete-expense"
                  data-id="${escapeHTML(expense.id)}"
                >
                  Delete
                </button>
              </td>
            </tr>
          `
        )
        .join('')
    : `
      <tr>
        <td colspan="6" class="empty">
          No expenses recorded yet.
        </td>
      </tr>
    `;
}

// Record a new business expense.
const expenseForm = $('expenseForm');

if (expenseForm) {
  expenseForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const title = $('expenseTitle').value.trim();
    const amount = Number($('expenseAmount').value);
    const category = $('expenseCategory').value;
    const payment = $('expensePayment').value;
    const date = $('expenseDate').value;

    // Validate expense details.
    if (
      !title ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !category ||
      !payment ||
      !date
    ) {
      alert('Please enter valid expense details.');
      return;
    }

    // Prevent future-dated expenses.
    if (date > todayKey()) {
      alert('Expense date cannot be in the future.');
      return;
    }

    const expense = {
      id: generateId(),
      title,
      amount,
      category,
      payment,
      date,
      createdAt: new Date().toISOString(),
    };

    expenses.push(expense);

    if (!saveData()) {
      expenses.pop();
      return;
    }

    this.reset();

    if ($('expenseDate')) {
      $('expenseDate').value = todayKey();
    }

    render();
    alert('Expense recorded successfully.');
  });
}

// Delete expenses using event delegation.
const expensesTable = $('expensesTable');

if (expensesTable) {
  expensesTable.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="delete-expense"]');

    if (!button) return;

    const id = button.dataset.id;
    const expense = expenses.find((item) => item.id === id);

    if (!expense) return;

    if (!confirm(`Delete expense "${expense.title}"?`)) {
      return;
    }

    const previousExpenses = expenses;

    expenses = expenses.filter((item) => item.id !== id);

    if (!saveData()) {
      expenses = previousExpenses;
      return;
    }

    render();
  });
}

/* ==========================================
   8. BUSINESS REPORT CALCULATIONS
   ========================================== */

// Collect sales and expenses within the selected date range.
function getReportData() {
  const start = $('reportStart')?.value;
  const end = $('reportEnd')?.value;

  if (!start || !end || start > end) {
    return null;
  }

  const periodSales = sales.filter(
    (sale) => sale.date >= start && sale.date <= end
  );

  const periodExpenses = expenses.filter(
    (expense) => expense.date >= start && expense.date <= end
  );

  // Calculate total revenue.
  const revenue = periodSales.reduce(
    (sum, sale) => sum + Number(sale.revenue || 0),
    0
  );

  // Calculate gross profit.
  const grossProfit = periodSales.reduce(
    (sum, sale) => sum + getSaleProfit(sale),
    0
  );

  // Calculate cost of goods sold.
  const cogs = revenue - grossProfit;

  // Calculate operating expenses.
  const operatingExpenses = periodExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  // Calculate net profit.
  const netProfit = grossProfit - operatingExpenses;

  return {
    start,
    end,
    periodSales,
    periodExpenses,
    revenue,
    grossProfit,
    cogs,
    operatingExpenses,
    netProfit,
  };
}

/* ==========================================
   9. BUSINESS REPORT DISPLAY
   ========================================== */

function renderReports() {
  const report = getReportData();

  // Clear report values when the date range is invalid.
  if (!report) {
    const reportFields = [
      'reportRevenue',
      'reportCOGS',
      'reportGrossProfit',
      'reportExpenses',
      'reportNetProfit',
      'reportTransactions',
      'reportMargin',
      'reportAverageSale',
      'reportExpenseRatio',
    ];

    reportFields.forEach((id) => {
      if ($(id)) {
        $(id).textContent =
          id.includes('Transactions') ||
          id.includes('Margin') ||
          id.includes('Ratio')
            ? '0'
            : money(0);
      }
    });

    if ($('expenseBreakdown')) {
      $('expenseBreakdown').innerHTML =
        '<p class="empty">Select a valid date range.</p>';
    }

    if ($('reportPeriod')) {
      $('reportPeriod').textContent = 'Please select a valid date range.';
    }

    return;
  }

  const {
    start,
    end,
    periodSales,
    periodExpenses,
    revenue,
    grossProfit,
    cogs,
    operatingExpenses,
    netProfit,
  } = report;

  const transactions = periodSales.length;

  // Calculate business performance indicators.
  const averageSale = transactions ? revenue / transactions : 0;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const expenseRatio = revenue > 0 ? (operatingExpenses / revenue) * 100 : 0;

  const values = {
    reportRevenue: money(revenue),
    reportCOGS: money(cogs),
    reportGrossProfit: money(grossProfit),
    reportExpenses: money(operatingExpenses),
    reportNetProfit: money(netProfit),
    reportTransactions: transactions.toLocaleString('en-KE'),
    reportMargin: `${grossMargin.toFixed(2)}%`,
    reportAverageSale: money(averageSale),
    reportExpenseRatio: `${expenseRatio.toFixed(2)}%`,
  };

  // Update report summary fields.
  Object.entries(values).forEach(([id, value]) => {
    if ($(id)) {
      $(id).textContent = value;
    }
  });

  // Highlight net profit or loss.
  if ($('reportNetProfit')) {
    $('reportNetProfit').className = netProfit < 0 ? 'negative' : 'positive';
  }

  // Display expense distribution.
  renderExpenseBreakdown(periodExpenses, operatingExpenses);

  if ($('reportPeriod')) {
    $('reportPeriod').textContent = `Report period: ${start} to ${end}`;
  }
}

// Display expenses grouped by category.
function renderExpenseBreakdown(periodExpenses, totalExpenses) {
  const breakdown = $('expenseBreakdown');

  if (!breakdown) return;

  const categories = {};

  periodExpenses.forEach((expense) => {
    const category = expense.category || 'Other';

    categories[category] =
      (categories[category] || 0) + Number(expense.amount || 0);
  });

  // Sort categories from highest expense to lowest.
  const sortedCategories = Object.entries(categories).sort(
    (a, b) => b[1] - a[1]
  );

  if (!sortedCategories.length) {
    breakdown.innerHTML = '<p class="empty">No expenses for this period.</p>';
    return;
  }

  breakdown.innerHTML = sortedCategories
    .map(([category, amount]) => {
      const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

      return `
        <div class="breakdown-item">
          <div class="breakdown-info">
            <span>${escapeHTML(category)}</span>
            <strong>${money(amount)}</strong>
          </div>

          <div class="breakdown-track">
            <div
              class="breakdown-fill"
              style="width: ${percentage.toFixed(2)}%"
            ></div>
          </div>

          <small>${percentage.toFixed(1)}% of expenses</small>
        </div>
      `;
    })
    .join('');
}

/* ==========================================
   10. REPORT DATE FILTERS
   ========================================== */

// Set the default report period to the current month.
function initializeReportFilters() {
  const today = todayKey();
  const firstDay = `${today.slice(0, 7)}-01`;

  if ($('reportStart') && !$('reportStart').value) {
    $('reportStart').value = firstDay;
  }

  if ($('reportEnd') && !$('reportEnd').value) {
    $('reportEnd').value = today;
  }

  if ($('expenseDate') && !$('expenseDate').value) {
    $('expenseDate').value = today;
  }
}

// Recalculate reports when the date range changes.
['reportStart', 'reportEnd'].forEach((id) => {
  if ($(id)) {
    $(id).addEventListener('change', renderReports);
  }
});

/* ==========================================
   11. PRINT BUSINESS REPORT
   ========================================== */

// Generate a printable report using the selected date range.
function printReport() {
  const report = getReportData();

  if (!report) {
    alert('Please select a valid reporting period.');
    return;
  }

  // Open a separate browser window.
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('Please allow pop-ups to print your report.');
    return;
  }

  const {
    start,
    end,
    periodSales,
    periodExpenses,
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit,
  } = report;

  // Calculate report performance indicators.
  const transactions = periodSales.length;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const expenseRatio = revenue > 0 ? (operatingExpenses / revenue) * 100 : 0;
  const averageSale = transactions ? revenue / transactions : 0;

  // Generate sales transaction rows.
  const salesRows = periodSales.length
    ? periodSales
        .map(
          (sale) => `
            <tr>
              <td>${escapeHTML(sale.date)}</td>
              <td>${escapeHTML(sale.name)}</td>
              <td>${Number(sale.quantity)}</td>
              <td>${money(sale.unitPrice)}</td>
              <td>${money(sale.revenue)}</td>
              <td>${money(getSaleProfit(sale))}</td>
            </tr>
          `
        )
        .join('')
    : `
        <tr>
          <td colspan="6">No sales recorded during this period.</td>
        </tr>
      `;

  // Generate expense transaction rows.
  const expenseRows = periodExpenses.length
    ? periodExpenses
        .map(
          (expense) => `
            <tr>
              <td>${escapeHTML(expense.date)}</td>
              <td>${escapeHTML(expense.title)}</td>
              <td>${escapeHTML(expense.category)}</td>
              <td>${escapeHTML(expense.payment)}</td>
              <td>${money(expense.amount)}</td>
            </tr>
          `
        )
        .join('')
    : `
        <tr>
          <td colspan="5">No expenses recorded during this period.</td>
        </tr>
      `;

  // Group expenses by category.
  const categoryTotals = {};

  periodExpenses.forEach((expense) => {
    const category = expense.category || 'Other';

    categoryTotals[category] =
      (categoryTotals[category] || 0) + Number(expense.amount || 0);
  });

  // Generate expense breakdown rows.
  const categoryRows = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const percentage =
        operatingExpenses > 0 ? (amount / operatingExpenses) * 100 : 0;

      return `
        <tr>
          <td>${escapeHTML(category)}</td>
          <td>${money(amount)}</td>
          <td>${percentage.toFixed(2)}%</td>
        </tr>
      `;
    })
    .join('');

  // Build the printable report.
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <title>Bizz Tracker - Business Report</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          color: #222;
          margin: 30px auto;
          padding: 20px;
          max-width: 1100px;
          line-height: 1.5;
        }

        .header {
          text-align: center;
          border-bottom: 2px solid #222;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }

        .header h1 {
          margin: 0;
          font-size: 30px;
        }

        .header p {
          color: #666;
          margin: 5px 0;
        }

        .section {
          margin-bottom: 30px;
        }

        h2 {
          font-size: 18px;
          margin-bottom: 12px;
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .summary-card {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 15px;
        }

        .summary-card p {
          margin: 0 0 8px;
          color: #666;
          font-size: 13px;
        }

        .summary-card strong {
          font-size: 18px;
        }

        .positive {
          color: #15803d;
        }

        .negative {
          color: #dc2626;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th,
        td {
          border: 1px solid #ddd;
          padding: 9px;
          font-size: 12px;
          text-align: left;
        }

        th {
          background: #f3f4f6;
        }

        .footer {
          border-top: 1px solid #ddd;
          padding-top: 15px;
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          .summary-card,
          tr {
            break-inside: avoid;
          }

          thead {
            display: table-header-group;
          }

          @page {
            size: A4;
            margin: 15mm;
          }
        }

        @media screen and (max-width: 600px) {
          .summary {
            grid-template-columns: repeat(2, 1fr);
          }

          body {
            padding: 10px;
          }
        }
      </style>
    </head>

    <body>

      <header class="header">
        <h1>Bizz Tracker</h1>
        <h2>Business Performance Report</h2>

        <p>
          Reporting Period:
          ${escapeHTML(start)} to ${escapeHTML(end)}
        </p>

        <p>
          Generated: ${escapeHTML(new Date().toLocaleString())}
        </p>
      </header>

      <section class="section">
        <h2>Financial Summary</h2>

        <div class="summary">

          <div class="summary-card">
            <p>Total Revenue</p>
            <strong>${money(revenue)}</strong>
          </div>

          <div class="summary-card">
            <p>Cost of Goods Sold</p>
            <strong>${money(cogs)}</strong>
          </div>

          <div class="summary-card">
            <p>Gross Profit</p>
            <strong>${money(grossProfit)}</strong>
          </div>

          <div class="summary-card">
            <p>Operating Expenses</p>
            <strong>${money(operatingExpenses)}</strong>
          </div>

          <div class="summary-card">
            <p>Net Profit / Loss</p>
            <strong class="${netProfit < 0 ? 'negative' : 'positive'}">
              ${money(netProfit)}
            </strong>
          </div>

          <div class="summary-card">
            <p>Sales Transactions</p>
            <strong>${transactions}</strong>
          </div>

          <div class="summary-card">
            <p>Gross Profit Margin</p>
            <strong>${grossMargin.toFixed(2)}%</strong>
          </div>

          <div class="summary-card">
            <p>Average Sale</p>
            <strong>${money(averageSale)}</strong>
          </div>

          <div class="summary-card">
            <p>Expense Ratio</p>
            <strong>${expenseRatio.toFixed(2)}%</strong>
          </div>

        </div>
      </section>

      <section class="section">
        <h2>Sales Transactions</h2>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Revenue</th>
              <th>Profit</th>
            </tr>
          </thead>

          <tbody>
            ${salesRows}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Operating Expenses</h2>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Payment Method</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            ${expenseRows}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Expense Breakdown</h2>

        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Total Amount</th>
              <th>Percentage</th>
            </tr>
          </thead>

          <tbody>
            ${
              categoryRows ||
              `
              <tr>
                <td colspan="3">No expense breakdown available.</td>
              </tr>
            `
            }
          </tbody>
        </table>
      </section>

      <footer class="footer">
        <p>Generated by Bizz Tracker</p>
        <p>Business financial report</p>
      </footer>

      <script>
        window.onload = function () {
          window.print();
        };
      <\/script>

    </body>
    </html>
  `);

  printWindow.document.close();
}

// Connect the print button.
const printButton = $('exportReport');

if (printButton) {
  printButton.addEventListener('click', printReport);
}

/* ==========================================
   12. APPLICATION INITIALIZATION
   ========================================== */

// Prepare the application when the script loads.
function initializeApp() {
  initializeReportFilters();

  // Display the current year in the footer.
  if ($('currentYear')) {
    $('currentYear').textContent = new Date().getFullYear();
  }

  // Render all application sections.
  render();
}

// Start the application.
initializeApp();
