// XRPL Transaction Test Generator
// Main application logic

// Global state
let definitions = null;
let workspaceBlocks = [];
let transactionType = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadDefinitions();
    initializePalette();
    initializeEventListeners();
    initializeKeyboardShortcuts();
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

    // Generate transaction type blocks
    generateTransactionTypeBlocks();
    
    // Generate field blocks by category
    generateFieldBlocks();
    
    // Setup collapsible categories
    setupCollapsibleCategories();
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
let draggedData = null;

function handleDragStart(e) {
    draggedData = {
        fieldName: e.target.dataset.fieldName,
        blockType: e.target.dataset.blockType
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
        setTransactionType(draggedData.fieldName);
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
        if (block.value && block.value.trim() !== '') {
            // Try to convert to appropriate type
            const fieldInfo = getFieldInfo(block.fieldName);
            transaction[block.fieldName] = convertFieldValue(block.value, fieldInfo);
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

