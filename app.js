// XRPL Transaction Test Generator
// Main application logic
// Version 2.2.2 - Simplified transaction signing using client.submitAndWait with autofill

// Global state
let definitions = null;
let workspaceBlocks = [];
let transactionType = null;
let draggedData = null;
let currentNetwork = 'testnet';
let accounts = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadDefinitions();
    initializePalette();
    initializeEventListeners();
    initializeKeyboardShortcuts();
    initializeNetworkManagement();
    updateJSONOutput();
});

// Load definitions.json
async function loadDefinitions() {
    try {
        const response = await fetch('definitions.json');
        definitions = await response.json();
        console.log('Definitions loaded:', definitions);
    } catch (error) {
        console.error('Error loading definitions:', error);
        showValidationMessage('Failed to load definitions.json', 'error');
    }
}

// Initialize block palette
function initializePalette() {
    if (!definitions) return;

    // Generate transaction type blocks only
    generateTransactionTypeBlocks();
    // Fields will be generated after transaction type is selected
}

// Generate transaction type blocks
function generateTransactionTypeBlocks() {
    const container = document.getElementById('transaction-types-palette');
    const types = definitions.TRANSACTION_TYPES;

    // Filter out invalid types and sort alphabetically
    const validTypes = Object.entries(types)
        .filter(([name, value]) => value >= 0)
        .sort((a, b) => a[0].localeCompare(b[0]));

    validTypes.forEach(([typeName, typeValue]) => {
        const block = createPaletteBlock(typeName, 'transaction-type', 'TransactionType');
        // Store the actual transaction type name in a data attribute
        block.dataset.transactionType = typeName;
        container.appendChild(block);
    });
}

// Generate field blocks organized by type
function generateFieldBlocks() {
    const fields = definitions.FIELDS;
    
    // Categorize fields
    const categories = {
        common: ['Account', 'Fee', 'Sequence', 'LastLedgerSequence', 'SigningPubKey'],
        account: [],
        amount: [],
        number: [],
        hash: [],
        blob: []
    };
    
    fields.forEach(([fieldName, fieldInfo]) => {
        if (!fieldInfo.isSerialized) return;
        
        const type = fieldInfo.type;
        
        // Skip if already in common
        if (categories.common.includes(fieldName)) return;
        
        // Categorize by type
        if (type === 'AccountID') {
            categories.account.push(fieldName);
        } else if (type === 'Amount') {
            categories.amount.push(fieldName);
        } else if (type.startsWith('UInt') || type === 'Number') {
            categories.number.push(fieldName);
        } else if (type.startsWith('Hash')) {
            categories.hash.push(fieldName);
        } else if (type === 'Blob') {
            categories.blob.push(fieldName);
        }
    });
    
    // Populate common fields
    populateFieldCategory('common-fields', categories.common, 'common-field');
    
    // Populate categorized fields
    populateFieldCategory('account-fields', categories.account.sort(), 'account-field');
    populateFieldCategory('amount-fields', categories.amount.sort(), 'amount-field');
    populateFieldCategory('number-fields', categories.number.sort(), 'number-field');
    populateFieldCategory('hash-fields', categories.hash.sort(), 'hash-field');
    populateFieldCategory('blob-fields', categories.blob.sort(), 'blob-field');
}

// Populate a field category
function populateFieldCategory(containerId, fields, blockClass) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    fields.forEach(fieldName => {
        const block = createPaletteBlock(fieldName, blockClass, fieldName);
        container.appendChild(block);
    });
}

// Create a palette block element
function createPaletteBlock(label, className, fieldName) {
    const block = document.createElement('div');
    block.className = `block ${className}`;
    block.textContent = label;
    block.draggable = true;
    block.dataset.fieldName = fieldName;
    block.dataset.blockType = className;

    // Add tooltip with field type information
    const fieldInfo = getFieldInfo(fieldName);
    if (fieldInfo) {
        block.title = `Type: ${fieldInfo.type}${fieldInfo.isSigningField ? ' (Signing Field)' : ''}`;
    }

    // Add drag event listeners
    block.addEventListener('dragstart', handleDragStart);

    return block;
}

// Setup collapsible categories
function setupCollapsibleCategories() {
    const categories = document.querySelectorAll('.palette-category.collapsible');
    
    categories.forEach(category => {
        category.addEventListener('click', () => {
            const targetId = category.dataset.target;
            const target = document.getElementById(targetId);
            
            if (target) {
                target.classList.toggle('collapsed');
                category.classList.toggle('collapsed');
            }
        });
    });
}

// Initialize event listeners
function initializeEventListeners() {
    const workspace = document.getElementById('workspace');
    
    // Workspace drag and drop
    workspace.addEventListener('dragover', handleDragOver);
    workspace.addEventListener('drop', handleDrop);
    workspace.addEventListener('dragleave', handleDragLeave);
    
    // Button listeners
    document.getElementById('clear-workspace').addEventListener('click', clearWorkspace);
    document.getElementById('example-selector').addEventListener('change', handleExampleSelection);
    document.getElementById('copy-json').addEventListener('click', copyJSON);
    document.getElementById('download-json').addEventListener('click', downloadJSON);
}

function handleExampleSelection(e) {
    const exampleType = e.target.value;
    if (exampleType) {
        loadExample(exampleType);
        e.target.value = ''; // Reset selector
    }
}

// Drag and Drop Handlers
function handleDragStart(e) {
    draggedData = {
        fieldName: e.target.dataset.fieldName,
        blockType: e.target.dataset.blockType,
        transactionType: e.target.dataset.transactionType // For transaction type blocks
    };
    e.dataTransfer.effectAllowed = 'copy';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (e.currentTarget === e.target) {
        e.currentTarget.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!draggedData) return;

    // Check if it's a transaction type block
    if (draggedData.blockType === 'transaction-type') {
        setTransactionType(draggedData.transactionType);
    } else {
        addFieldBlock(draggedData.fieldName, draggedData.blockType);
    }

    draggedData = null;
    updateJSONOutput();
}

// Workspace Management
function setTransactionType(typeName) {
    transactionType = typeName;

    // Remove existing transaction type block if any
    const existingTypeBlock = document.querySelector('.workspace-block[data-field="TransactionType"]');
    if (existingTypeBlock) {
        existingTypeBlock.remove();
    }

    // Add new transaction type block at the top
    const workspace = document.getElementById('workspace');
    const placeholder = workspace.querySelector('.workspace-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const blockWrapper = createWorkspaceBlock('TransactionType', 'transaction-type', typeName, true);
    workspace.insertBefore(blockWrapper, workspace.firstChild);

    // Show fields section and populate with relevant fields
    showFieldsForTransactionType(typeName);
}

function showFieldsForTransactionType(typeName) {
    const fieldsSection = document.getElementById('fields-section');
    const container = document.getElementById('available-fields-container');

    // Show the fields section
    fieldsSection.style.display = 'block';

    // Clear existing fields
    container.innerHTML = '';

    // Get valid fields for this transaction type
    let validFields = [];

    if (definitions.TRANSACTION_FORMATS && definitions.TRANSACTION_FORMATS[typeName]) {
        const format = definitions.TRANSACTION_FORMATS[typeName];
        validFields = format.map(f => ({
            name: f.name,
            required: f.required === 0 // 0 = required, 1 = optional, 2 = default
        }));
        console.log(`Found ${validFields.length} fields for ${typeName}:`, validFields.map(f => f.name));
    } else {
        console.warn(`No TRANSACTION_FORMATS found for ${typeName}`);
    }

    // Always add common fields if not already present
    const commonFields = ['Account', 'Fee', 'Sequence', 'LastLedgerSequence', 'SigningPubKey'];
    commonFields.forEach(fieldName => {
        if (!validFields.find(f => f.name === fieldName)) {
            validFields.push({ name: fieldName, required: false });
        }
    });

    // Sort: required first, then alphabetically
    validFields.sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    console.log(`Total fields to display: ${validFields.length}`);

    // Create field blocks
    validFields.forEach(field => {
        const fieldInfo = getFieldInfo(field.name);
        if (!fieldInfo) {
            console.warn(`No field info found for ${field.name}`);
            return;
        }

        const blockType = getBlockTypeForField(fieldInfo);
        const label = field.required ? `${field.name} *` : field.name;
        const block = createPaletteBlock(label, blockType, field.name);

        // Make required fields bold
        if (field.required) {
            block.style.fontWeight = 'bold';
        }

        container.appendChild(block);
    });
}

function getBlockTypeForField(fieldInfo) {
    const type = fieldInfo.type;

    if (type === 'AccountID') return 'account-field';
    if (type === 'Amount') return 'amount-field';
    if (type.startsWith('UInt') || type === 'Number') return 'number-field';
    if (type.startsWith('Hash')) return 'hash-field';
    if (type === 'Blob') return 'blob-field';

    return 'common-field';
}

function addFieldBlock(fieldName, blockType) {
    // Check if field already exists
    const existing = document.querySelector(`.workspace-block[data-field="${fieldName}"]`);
    if (existing) {
        showValidationMessage(`Field "${fieldName}" already added`, 'warning');
        return;
    }

    const workspace = document.getElementById('workspace');
    const placeholder = workspace.querySelector('.workspace-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const blockWrapper = createWorkspaceBlock(fieldName, blockType, '', false);
    workspace.appendChild(blockWrapper);

    // Add to workspace blocks array
    workspaceBlocks.push({
        fieldName: fieldName,
        value: ''
    });
}

function createWorkspaceBlock(fieldName, blockType, value, isTransactionType) {
    const wrapper = document.createElement('div');
    wrapper.className = 'workspace-block';
    wrapper.dataset.field = fieldName;

    const block = document.createElement('div');
    block.className = `block ${blockType}`;

    const label = document.createElement('span');
    label.className = 'block-label';
    label.textContent = fieldName + ':';
    block.appendChild(label);

    if (isTransactionType) {
        // Transaction type is a dropdown
        const select = document.createElement('select');
        select.className = 'block-input';

        const types = Object.keys(definitions.TRANSACTION_TYPES)
            .filter(name => definitions.TRANSACTION_TYPES[name] >= 0)
            .sort();

        types.forEach(typeName => {
            const option = document.createElement('option');
            option.value = typeName;
            option.textContent = typeName;
            if (typeName === value) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            transactionType = e.target.value;
            updateJSONOutput();
        });

        block.appendChild(select);
    } else {
        // Check if this is an Account field
        const fieldInfo = getFieldInfo(fieldName);
        const isAccountField = fieldInfo && fieldInfo.type === 'AccountID';

        if (isAccountField && accounts.length > 0) {
            // Create a container for input and dropdown
            const inputContainer = document.createElement('div');
            inputContainer.className = 'input-with-dropdown';

            // Regular input
            const input = document.createElement('input');
            input.className = 'block-input';
            input.type = 'text';
            input.placeholder = `Enter ${fieldName}`;
            input.value = value;

            input.addEventListener('input', (e) => {
                updateFieldValue(fieldName, e.target.value);
            });

            // Account selector dropdown
            const accountSelect = document.createElement('select');
            accountSelect.className = 'account-selector';
            accountSelect.title = 'Select from saved accounts';

            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '👤 Select Account';
            accountSelect.appendChild(placeholderOption);

            // Add accounts
            accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.address;
                option.textContent = account.address;
                option.title = account.seed ? 'Has signing key' : 'View only';
                accountSelect.appendChild(option);
            });

            accountSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    input.value = e.target.value;
                    updateFieldValue(fieldName, e.target.value);
                    updateJSONOutput();
                }
                // Reset dropdown to placeholder
                e.target.value = '';
            });

            inputContainer.appendChild(input);
            inputContainer.appendChild(accountSelect);
            block.appendChild(inputContainer);
        } else {
            // Regular field is an input
            const input = document.createElement('input');
            input.className = 'block-input';
            input.type = 'text';
            input.placeholder = `Enter ${fieldName}`;
            input.value = value;

            input.addEventListener('input', (e) => {
                updateFieldValue(fieldName, e.target.value);
            });

            block.appendChild(input);
        }

        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'block-remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            removeFieldBlock(fieldName);
        });
        block.appendChild(removeBtn);
    }

    wrapper.appendChild(block);
    return wrapper;
}

function updateFieldValue(fieldName, value) {
    const blockIndex = workspaceBlocks.findIndex(b => b.fieldName === fieldName);
    if (blockIndex >= 0) {
        workspaceBlocks[blockIndex].value = value;
    }
    updateJSONOutput();
}

function removeFieldBlock(fieldName) {
    const blockElement = document.querySelector(`.workspace-block[data-field="${fieldName}"]`);
    if (blockElement) {
        blockElement.remove();
    }

    workspaceBlocks = workspaceBlocks.filter(b => b.fieldName !== fieldName);
    updateJSONOutput();

    // Show placeholder if workspace is empty
    const workspace = document.getElementById('workspace');
    if (workspace.children.length === 0) {
        showWorkspacePlaceholder();
    }
}

function showWorkspacePlaceholder() {
    const workspace = document.getElementById('workspace');
    const placeholder = document.createElement('div');
    placeholder.className = 'workspace-placeholder';
    placeholder.innerHTML = `
        <p>👆 Drag blocks here to build your transaction</p>
        <p class="hint">Start with a Transaction Type block</p>
    `;
    workspace.appendChild(placeholder);
}

function clearWorkspace() {
    const workspace = document.getElementById('workspace');
    workspace.innerHTML = '';
    workspaceBlocks = [];
    transactionType = null;
    showWorkspacePlaceholder();
    updateJSONOutput();
    clearValidationMessages();
}

// JSON Output Generation
function updateJSONOutput() {
    const transaction = buildTransactionObject();
    const jsonOutput = document.getElementById('json-output');
    jsonOutput.textContent = JSON.stringify(transaction, null, 2);

    validateTransaction(transaction);
}

function buildTransactionObject() {
    const transaction = {};

    // Add transaction type
    if (transactionType) {
        transaction.TransactionType = transactionType;
    }

    // Add fields with values
    workspaceBlocks.forEach(block => {
        // Convert value to string if it's not already
        const valueStr = typeof block.value === 'string' ? block.value : String(block.value);

        if (block.value && valueStr.trim() !== '') {
            // Try to convert to appropriate type
            const fieldInfo = getFieldInfo(block.fieldName);
            transaction[block.fieldName] = convertFieldValue(valueStr, fieldInfo);
        }
    });

    return transaction;
}

function getFieldInfo(fieldName) {
    const field = definitions.FIELDS.find(([name]) => name === fieldName);
    return field ? field[1] : null;
}

function convertFieldValue(value, fieldInfo) {
    if (!fieldInfo) return value;

    const type = fieldInfo.type;

    // Convert numeric types
    if (type.startsWith('UInt') || type === 'Number') {
        const num = parseInt(value, 10);
        return isNaN(num) ? value : num;
    }

    // Keep strings as-is for now
    return value;
}

// Validation
function validateTransaction(transaction) {
    clearValidationMessages();

    if (!transaction.TransactionType) {
        showValidationMessage('⚠️ Transaction Type is required', 'error');
        return;
    }

    // Check for required common fields
    const warnings = [];

    if (!transaction.Account) {
        warnings.push('💡 Account field is recommended');
    }

    if (!transaction.Fee) {
        warnings.push('💡 Fee field is recommended');
    }

    if (warnings.length > 0) {
        warnings.forEach(warning => showValidationMessage(warning, 'warning'));
    } else {
        showValidationMessage('✅ Transaction structure looks good!', 'success');
    }
}

function showValidationMessage(message, type) {
    const container = document.getElementById('validation-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `validation-message ${type}`;
    messageDiv.textContent = message;
    container.appendChild(messageDiv);
}

function clearValidationMessages() {
    const container = document.getElementById('validation-messages');
    container.innerHTML = '';
}

// Utility Functions
function copyJSON() {
    const jsonOutput = document.getElementById('json-output');
    const text = jsonOutput.textContent;
    const btn = document.getElementById('copy-json');

    navigator.clipboard.writeText(text).then(() => {
        showValidationMessage('✅ JSON copied to clipboard!', 'success');
        btn.classList.add('success-flash');
        setTimeout(() => {
            clearValidationMessages();
            btn.classList.remove('success-flash');
        }, 2000);
    }).catch(err => {
        showValidationMessage('❌ Failed to copy JSON', 'error');
    });
}

function downloadJSON() {
    const jsonOutput = document.getElementById('json-output');
    const text = jsonOutput.textContent;
    const btn = document.getElementById('download-json');

    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xrpl-transaction-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showValidationMessage('✅ JSON downloaded!', 'success');
    btn.classList.add('success-flash');
    setTimeout(() => {
        clearValidationMessages();
        btn.classList.remove('success-flash');
    }, 2000);
}

function loadExample(exampleType = 'payment') {
    clearWorkspace();

    const examples = {
        payment: {
            type: 'Payment',
            fields: [
                { name: 'Account', value: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnHf', class: 'account-field' },
                { name: 'Destination', value: 'rLHzPsX6oXkzU9rFkRrJYTetvcqrKKKKKK', class: 'account-field' },
                { name: 'Amount', value: '1000000', class: 'amount-field' },
                { name: 'Fee', value: '12', class: 'common-field' },
                { name: 'Sequence', value: '1', class: 'number-field' }
            ]
        },
        trustset: {
            type: 'TrustSet',
            fields: [
                { name: 'Account', value: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnHf', class: 'account-field' },
                { name: 'Fee', value: '12', class: 'common-field' },
                { name: 'Sequence', value: '1', class: 'number-field' },
                { name: 'LimitAmount', value: '1000000000', class: 'amount-field' }
            ]
        },
        accountset: {
            type: 'AccountSet',
            fields: [
                { name: 'Account', value: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnHf', class: 'account-field' },
                { name: 'Fee', value: '12', class: 'common-field' },
                { name: 'Sequence', value: '1', class: 'number-field' },
                { name: 'SetFlag', value: '5', class: 'number-field' }
            ]
        },
        offercreate: {
            type: 'OfferCreate',
            fields: [
                { name: 'Account', value: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnHf', class: 'account-field' },
                { name: 'Fee', value: '12', class: 'common-field' },
                { name: 'Sequence', value: '1', class: 'number-field' },
                { name: 'TakerGets', value: '1000000', class: 'amount-field' },
                { name: 'TakerPays', value: '2000000', class: 'amount-field' }
            ]
        }
    };

    const example = examples[exampleType];
    if (!example) return;

    setTransactionType(example.type);

    // Add fields with a slight delay for animation
    setTimeout(() => {
        example.fields.forEach((field, index) => {
            setTimeout(() => {
                addFieldBlock(field.name, field.class);
                setTimeout(() => {
                    setExampleValue(field.name, field.value);
                }, 50);
            }, index * 100);
        });

        setTimeout(() => {
            updateJSONOutput();
        }, example.fields.length * 100 + 100);
    }, 100);
}

function setExampleValue(fieldName, value) {
    const blockElement = document.querySelector(`.workspace-block[data-field="${fieldName}"]`);
    if (blockElement) {
        const input = blockElement.querySelector('.block-input');
        if (input) {
            input.value = value;
            updateFieldValue(fieldName, value);
        }
    }
}

// Keyboard Shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to clear workspace
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            clearWorkspace();
        }

        // Ctrl/Cmd + C when focused on output to copy
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.target.id === 'json-output') {
            e.preventDefault();
            copyJSON();
        }

        // Ctrl/Cmd + S to download
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            downloadJSON();
        }

        // Escape to clear validation messages
        if (e.key === 'Escape') {
            clearValidationMessages();
        }
    });
}

// Network and Account Management
function initializeNetworkManagement() {
    // Network selector
    document.getElementById('network-select').addEventListener('change', (e) => {
        currentNetwork = e.target.value;
        updateNetworkInfo();
        showMessage(`Switched to ${currentNetwork}`, 'info');
    });

    // Add account button
    document.getElementById('add-account-btn').addEventListener('click', addAccount);

    // Generate account button
    document.getElementById('generate-account-btn').addEventListener('click', generateAccount);

    // Submit transaction button
    document.getElementById('submit-tx-btn').addEventListener('click', submitTransaction);

    // Transaction type search
    const searchInput = document.getElementById('tx-type-search');
    searchInput.addEventListener('input', (e) => {
        filterTransactionTypes(e.target.value);
    });

    // Initialize network info
    updateNetworkInfo();
}

function updateNetworkInfo() {
    const networkInfo = document.getElementById('network-info');
    const networks = {
        mainnet: 'wss://xrplcluster.com',
        testnet: 'wss://s.altnet.rippletest.net:51233',
        devnet: 'wss://s.devnet.rippletest.net:51233'
    };
    networkInfo.textContent = `Connected to ${currentNetwork.charAt(0).toUpperCase() + currentNetwork.slice(1)} (${networks[currentNetwork]})`;
}

function addAccount() {
    const address = prompt('Enter XRPL account address:');
    if (!address || address.trim() === '') return; // Cancelled or empty

    const accountAddress = address.trim();

    if (!isValidXRPLAddress(accountAddress)) {
        showMessage('❌ Invalid XRPL address format', 'error');
        return;
    }

    // Check if account already exists
    if (accounts.find(acc => acc.address === accountAddress)) {
        showMessage('⚠️ Account already added', 'warning');
        return;
    }

    accounts.push({
        address: accountAddress,
        seed: null // No seed for manually added accounts
    });
    renderAccounts();
    showMessage(`✅ Account added: ${accountAddress}`, 'success');
}

async function generateAccount() {
    try {
        // Use xrpl.js to generate a new wallet
        if (typeof xrpl === 'undefined') {
            showMessage('❌ xrpl.js library not loaded', 'error');
            return;
        }

        const wallet = xrpl.Wallet.generate();

        accounts.push({
            address: wallet.address,
            seed: wallet.seed
        });

        renderAccounts();
        showMessage(`✅ Generated new account: ${wallet.address}`, 'success');

        // Show seed in a prompt for user to save
        alert(`🔑 SAVE THIS SEED SAFELY!\n\nAddress: ${wallet.address}\nSeed: ${wallet.seed}\n\nYou will need this seed to sign transactions.`);

    } catch (error) {
        showMessage(`❌ Error generating account: ${error.message}`, 'error');
    }
}

function generateTestAddress() {
    // Generate a random test address (starts with 'r')
    const chars = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
    let address = 'r';
    for (let i = 0; i < 33; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
}

function isValidXRPLAddress(address) {
    // Basic validation: starts with 'r' and is 25-35 characters
    return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

async function fundAccount(address) {
    const faucets = {
        testnet: 'https://faucet.altnet.rippletest.net/accounts',
        devnet: 'https://faucet.devnet.rippletest.net/accounts'
    };

    const faucetUrl = faucets[currentNetwork];
    if (!faucetUrl) {
        showMessage('❌ Faucet not available for this network', 'error');
        return;
    }

    try {
        showMessage(`💰 Requesting funds for ${address}...`, 'info');

        const response = await fetch(faucetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                destination: address
            })
        });

        if (!response.ok) {
            throw new Error(`Faucet request failed: ${response.statusText}`);
        }

        const data = await response.json();
        showMessage(`✅ Account funded! Balance: ${data.balance?.value || 'Unknown'} XRP`, 'success');
        console.log('Faucet response:', data);

    } catch (error) {
        showMessage(`❌ Error funding account: ${error.message}`, 'error');
        console.error('Faucet error:', error);
    }
}

function renderAccounts() {
    const list = document.getElementById('accounts-list');
    list.innerHTML = '';

    if (accounts.length === 0) {
        list.innerHTML = '<p class="no-accounts">No accounts added</p>';
        refreshAccountDropdowns();
        return;
    }

    accounts.forEach((account, index) => {
        const item = document.createElement('div');
        item.className = 'account-item';

        const icon = document.createElement('span');
        icon.className = 'account-icon';
        icon.textContent = account.seed ? '🔑' : '👁️';
        icon.title = account.seed ? 'Has private key' : 'View only';

        const addressSpan = document.createElement('span');
        addressSpan.className = 'account-address';
        addressSpan.textContent = account.address;
        addressSpan.title = account.address;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'account-buttons';

        // Add Fund button for testnet/devnet
        if (currentNetwork !== 'mainnet') {
            const fundBtn = document.createElement('button');
            fundBtn.className = 'account-fund';
            fundBtn.textContent = '💰';
            fundBtn.title = 'Fund account from faucet';
            fundBtn.addEventListener('click', () => fundAccount(account.address));
            buttonContainer.appendChild(fundBtn);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'account-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove account';
        removeBtn.addEventListener('click', () => {
            accounts.splice(index, 1);
            renderAccounts();
            showMessage(`🗑️ Account removed: ${account.address}`, 'info');
        });

        buttonContainer.appendChild(removeBtn);

        item.appendChild(icon);
        item.appendChild(addressSpan);
        item.appendChild(buttonContainer);
        list.appendChild(item);
    });

    // Refresh all account dropdowns in workspace
    refreshAccountDropdowns();
}

function refreshAccountDropdowns() {
    // First, update existing dropdowns
    const accountSelectors = document.querySelectorAll('.account-selector');

    accountSelectors.forEach(select => {
        const currentValue = select.value;

        // Clear existing options
        select.innerHTML = '';

        // Add placeholder
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = accounts.length > 0 ? '👤 Select Account' : '👤 No Accounts';
        placeholderOption.disabled = accounts.length === 0;
        select.appendChild(placeholderOption);

        // Add accounts
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.address;
            option.textContent = account.address;
            option.title = account.seed ? 'Has signing key' : 'View only';
            select.appendChild(option);
        });

        // Restore selection if it was set
        select.value = currentValue;
    });

    // Second, rebuild AccountID blocks that don't have dropdowns yet
    const workspaceBlocks = document.querySelectorAll('.workspace-block');
    workspaceBlocks.forEach(blockWrapper => {
        const fieldName = blockWrapper.dataset.field;
        if (!fieldName || fieldName === 'TransactionType') return;

        const fieldInfo = getFieldInfo(fieldName);
        const isAccountField = fieldInfo && fieldInfo.type === 'AccountID';

        // If it's an account field and doesn't have a dropdown yet, rebuild it
        if (isAccountField && !blockWrapper.querySelector('.account-selector') && accounts.length > 0) {
            const block = blockWrapper.querySelector('.block');
            const input = block.querySelector('.block-input');
            const currentValue = input ? input.value : '';

            // Get the block type
            const blockType = block.className.split(' ').find(c => c.endsWith('-field')) || 'common-field';

            // Remove the old input
            if (input) {
                input.remove();
            }

            // Create new input with dropdown
            const inputContainer = document.createElement('div');
            inputContainer.className = 'input-with-dropdown';

            const newInput = document.createElement('input');
            newInput.className = 'block-input';
            newInput.type = 'text';
            newInput.placeholder = `Enter ${fieldName}`;
            newInput.value = currentValue;

            newInput.addEventListener('input', (e) => {
                updateFieldValue(fieldName, e.target.value);
            });

            // Account selector dropdown
            const accountSelect = document.createElement('select');
            accountSelect.className = 'account-selector';
            accountSelect.title = 'Select from saved accounts';

            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '👤 Select Account';
            accountSelect.appendChild(placeholderOption);

            // Add accounts
            accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.address;
                option.textContent = account.address;
                option.title = account.seed ? 'Has signing key' : 'View only';
                accountSelect.appendChild(option);
            });

            accountSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    newInput.value = e.target.value;
                    updateFieldValue(fieldName, e.target.value);
                    updateJSONOutput();
                }
                // Reset dropdown to placeholder
                e.target.value = '';
            });

            inputContainer.appendChild(newInput);
            inputContainer.appendChild(accountSelect);

            // Insert before the remove button
            const removeBtn = block.querySelector('.block-remove');
            block.insertBefore(inputContainer, removeBtn);
        }
    });
}

function filterTransactionTypes(searchTerm) {
    const blocks = document.querySelectorAll('#transaction-types-palette .block');
    const term = searchTerm.toLowerCase();

    blocks.forEach(block => {
        const text = block.textContent.toLowerCase();
        if (text.includes(term)) {
            block.style.display = '';
        } else {
            block.style.display = 'none';
        }
    });
}

async function submitTransaction() {
    const transaction = buildTransactionObject();

    if (!transactionType) {
        showMessage('❌ Please select a transaction type first', 'error');
        return;
    }

    // Check if we have an account with a seed
    const signingAccount = accounts.find(acc => acc.seed);
    if (!signingAccount) {
        showMessage('❌ No account with signing key available. Generate an account first.', 'error');
        return;
    }

    // Get network endpoint
    const networks = {
        mainnet: 'wss://xrplcluster.com',
        testnet: 'wss://s.altnet.rippletest.net:51233',
        devnet: 'wss://s.devnet.rippletest.net:51233'
    };

    const endpoint = networks[currentNetwork];

    try {
        showMessage(`🔄 Connecting to ${currentNetwork}...`, 'info');

        const client = new xrpl.Client(endpoint);
        await client.connect();

        showMessage('🔄 Preparing and signing transaction...', 'info');

        // Create wallet from seed
        const wallet = xrpl.Wallet.fromSeed(signingAccount.seed);

        // Auto-fill Account field if not set
        if (!transaction.Account) {
            transaction.Account = wallet.address;
        }

        // Submit and wait for validation (autofill and sign automatically)
        const result = await client.submitAndWait(transaction, {
            autofill: true,
            wallet: wallet
        });

        // Update workspace with the submitted transaction
        if (result.result.tx_json) {
            updateWorkspaceWithTransaction(result.result.tx_json);
            showMessage('✅ Transaction autofilled and signed', 'success');
        }

        await client.disconnect();

        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            showMessage(`✅ Transaction successful! Hash: ${result.result.hash}`, 'success');
            console.log('Transaction result:', result);
        } else {
            showMessage(`⚠️ Transaction failed: ${result.result.meta.TransactionResult}`, 'warning');
            console.log('Transaction result:', result);
        }

    } catch (error) {
        showMessage(`❌ Error: ${error.message}`, 'error');
        console.error('Transaction error:', error);
    }
}

function updateWorkspaceWithTransaction(transaction) {
    // Update existing fields or add new ones with autofilled values
    Object.entries(transaction).forEach(([fieldName, value]) => {
        if (fieldName === 'TransactionType') return; // Skip, already set

        // Convert value to string
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

        // Check if field already exists in workspace
        const existingBlock = document.querySelector(`.workspace-block[data-field="${fieldName}"]`);

        if (existingBlock) {
            // Update existing field value
            const input = existingBlock.querySelector('.block-input');
            if (input) {
                input.value = valueStr;
                updateFieldValue(fieldName, valueStr);
            }
        } else {
            // Add new field block
            const fieldInfo = getFieldInfo(fieldName);
            if (fieldInfo) {
                const blockType = getBlockTypeForField(fieldInfo);

                // Add to workspace blocks array
                workspaceBlocks.push({
                    fieldName: fieldName,
                    value: valueStr
                });

                // Create and add the block to workspace
                const workspace = document.getElementById('workspace');
                const blockWrapper = createWorkspaceBlock(fieldName, blockType, valueStr, false);
                workspace.appendChild(blockWrapper);
            }
        }
    });

    updateJSONOutput();
}

function showMessage(message, type = 'info') {
    const container = document.getElementById('validation-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `validation-message ${type}`;
    messageDiv.textContent = message;
    container.appendChild(messageDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

