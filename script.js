// Dark mode support
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (event.matches) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
});

// 🔒 Hard-coded Google Apps Script URL (ไม่หายเมื่อเปลี่ยนเครื่อง)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXhQa74qGDUfzRAMZ_CZfV5-9NqL481O7WkkSnmOwAKLUCtYH9o4tNF4eqnoQYtn1haQ/exec";

// Data storage (in memory since localStorage not available in iframe)
let appData = {
    customers: [],
    meterData: {}, // will be organized by customer ID
    settings: {
        waterBaseFee: 8.50,
        waterUnitRate: 18.00,
        electricBaseFee: 38.22,
        electricUnitRate: 4.18
    }
};

let currentCustomerId = null;
let isEditingCustomer = false;
let editingCustomerId = null;

// DOM elements
const tabs = {
    customers: null,
    record: null,
    summary: null,
    history: null,
    settings: null
};

const contents = {
    customers: null,
    record: null,
    summary: null,
    history: null,
    settings: null
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialize DOM references
    tabs.customers = document.getElementById('customersTab');
    tabs.record = document.getElementById('recordTab');
    tabs.summary = document.getElementById('summaryTab');
    tabs.history = document.getElementById('historyTab');
    tabs.settings = document.getElementById('settingsTab');

    // Create content containers
    createContentContainers();
    
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('waterDate').value = today;
    document.getElementById('electricDate').value = today;

    // Load settings to UI
    loadSettings();
    
    // โหลด Google Script URL ที่บันทึกไว้
    loadGoogleScriptUrl();
    
    // Update displays
    updateCustomersList();
    updateCustomerDropdowns();
    updateCurrentUsage();
    updateSummary();
    updateHistoryDisplay();

    // Tab switching
    Object.keys(tabs).forEach(tabName => {
        if (tabs[tabName]) {
            tabs[tabName].addEventListener('click', () => switchTab(tabName));
        }
    });

    // Initialize event listeners
    initializeEventListeners();
    
    // Initialize period display
    updatePeriodDisplay();
    
    // Try to load data from Google Sheets on startup if URL is available
    tryAutoLoadFromGoogleSheets();
    
    // ซ่อน URL field และแสดงสถานะ
    setTimeout(() => {
        toggleUrlVisibility(false);
    }, 500);
}

function createContentContainers() {
    const appContent = document.getElementById('app-content');
    
    appContent.innerHTML = `
        <!-- Customers Tab -->
        <div id="customersContent" class="tab-content p-6">
            <div class="space-y-6">
                <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">จัดการข้อมูลลูกค้า</h3>
                    <button id="addCustomer" class="bg-primary hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors">
                        ➕ เพิ่มลูกค้าใหม่
                    </button>
                </div>

                <!-- Add Customer Form -->
                <div id="customerForm" class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 hidden">
                    <h4 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">เพิ่มลูกค้าใหม่</h4>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ชื่อลูกค้า</label>
                            <input id="customerName" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base" placeholder="ชื่อ-นามสกุล">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">เลขห้อง/ที่อยู่</label>
                            <input id="customerAddress" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base" placeholder="เลขห้อง/ที่อยู่">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">เบอร์โทรศัพท์</label>
                            <input id="customerPhone" type="tel" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base" placeholder="08X-XXX-XXXX">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">หมายเหตุ</label>
                            <input id="customerNote" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base" placeholder="หมายเหตุ (ถ้ามี)">
                        </div>
                    </div>
                    <div class="flex justify-end space-x-3 mt-4">
                        <button id="cancelCustomer" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">ยกเลิก</button>
                        <button id="saveCustomer" class="px-4 py-2 bg-primary text-white hover:bg-purple-600 rounded transition-colors">บันทึก</button>
                    </div>
                </div>

                <!-- Customers List -->
                <div id="customersList" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <!-- Customer cards will be added here -->
                </div>
            </div>
        </div>

        <!-- Record Tab -->
        <div id="recordContent" class="tab-content p-6 hidden">
            <!-- Customer Selection -->
            <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 mb-6">
                <h3 class="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-4">👤 เลือกลูกค้า</h3>
                <select id="selectedCustomer" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                    <option value="">-- เลือกลูกค้า --</option>
                </select>
            </div>

            <div id="meterInputs" class="hidden">
                <div class="grid md:grid-cols-2 gap-6">
                    <!-- Water Meter -->
                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-4 flex items-center">
                            💧 มิเตอร์น้ำ
                        </h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">เลขมิเตอร์ปัจจุบัน</label>
                                <input id="waterMeter" type="number" step="0.01" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">วันที่อ่าน</label>
                                <input id="waterDate" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                            </div>
                            <button id="saveWater" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                                บันทึกมิเตอร์น้ำ
                            </button>
                        </div>
                    </div>

                    <!-- Electric Meter -->
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-4 flex items-center">
                            ⚡ มิเตอร์ไฟฟ้า
                        </h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">เลขมิเตอร์ปัจจุบัน</label>
                                <input id="electricMeter" type="number" step="0.01" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">วันที่อ่าน</label>
                                <input id="electricDate" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                            </div>
                            <button id="saveElectric" class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                                บันทึกมิเตอร์ไฟฟ้า
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Period Selection -->
                <div class="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">📅 เลือกช่วงเวลาคำนวณ</h3>
                    <div class="grid md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ช่วงเวลา</label>
                            <select id="periodType" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                                <option value="current_month">เดือนปัจจุบัน</option>
                                <option value="last_month">เดือนที่แล้ว</option>
                                <option value="last_3_months">3 เดือนที่แล้ว</option>
                                <option value="last_6_months">6 เดือนที่แล้ว</option>
                                <option value="custom">กำหนดเอง</option>
                            </select>
                        </div>
                        <div id="customDateStart" class="hidden">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">วันที่เริ่มต้น</label>
                            <input id="startDate" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                        </div>
                        <div id="customDateEnd" class="hidden">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">วันที่สิ้นสุด</label>
                            <input id="endDate" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                        </div>
                    </div>
                    <button id="updatePeriod" class="mt-4 bg-primary hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors">
                        🔄 อัปเดตการคำนวณ
                    </button>
                </div>

                <!-- Current Usage Summary -->
                <div id="currentUsage" class="mt-6 bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-green-700 dark:text-green-300 mb-4">
                        💰 สรุปค่าใช้จ่าย <span id="periodLabel">เดือนปัจจุบัน</span>
                    </h3>
                    <div id="usageDetails" class="mb-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                        <span id="periodDateRange"></span>
                    </div>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400" id="waterUsage">0</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">หน่วย น้ำ</div>
                            <div class="text-lg font-semibold text-blue-700 dark:text-blue-300" id="waterCost">฿0</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400" id="electricUsage">0</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">หน่วย ไฟฟ้า</div>
                            <div class="text-lg font-semibold text-yellow-700 dark:text-yellow-300" id="electricCost">฿0</div>
                        </div>
                    </div>
                    <div class="mt-4 text-center border-t pt-4 border-green-200 dark:border-green-700">
                        <div class="text-xl font-bold text-green-700 dark:text-green-300" id="totalCost">รวม: ฿0</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary Tab -->
        <div id="summaryContent" class="tab-content p-6 hidden">
            <div class="space-y-6">
                <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">📈 สรุปยอดรวมทุกลูกค้า</h3>
                
                <!-- Period Selection for Summary -->
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
                    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ช่วงเวลาสรุป</label>
                            <select id="summaryPeriodType" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                                <option value="current_month">เดือนปัจจุบัน</option>
                                <option value="last_month">เดือนที่แล้ว</option>
                                <option value="last_3_months">3 เดือนที่แล้ว</option>
                                <option value="last_6_months">6 เดือนที่แล้ว</option>
                            </select>
                        </div>
                        <button id="updateSummary" class="bg-primary hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors mt-6 sm:mt-0">
                            🔄 อัปเดตสรุป
                        </button>
                    </div>
                </div>

                <!-- Summary Cards -->
                <div id="summaryCards" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <!-- Summary cards will be added here -->
                </div>

                <!-- Total Summary -->
                <div class="bg-primary text-white rounded-lg p-6">
                    <h4 class="text-lg font-semibold mb-4">💰 ยอดรวมทั้งหมด</h4>
                    <div class="grid md:grid-cols-3 gap-4 text-center">
                        <div>
                            <div class="text-2xl font-bold" id="totalWaterUsage">0</div>
                            <div class="text-sm opacity-80">หน่วย น้ำ</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold" id="totalElectricUsage">0</div>
                            <div class="text-sm opacity-80">หน่วย ไฟฟ้า</div>
                        </div>
                        <div>
                            <div class="text-3xl font-bold" id="grandTotal">฿0</div>
                            <div class="text-sm opacity-80">ยอดรวมทั้งหมด</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- History Tab -->
        <div id="historyContent" class="tab-content p-6 hidden">
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">📋 ประวัติการบันทึก</h3>
                    <div class="flex gap-2">
                        <select id="historyCustomerFilter" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                            <option value="">-- ทุกลูกค้า --</option>
                        </select>
                        <button id="clearHistory" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                            🗑️ ล้างประวัติ
                        </button>
                    </div>
                </div>
                <div id="historyList" class="space-y-3">
                    <!-- History items will be added here -->
                </div>
            </div>
        </div>

        <!-- Settings Tab -->
        <div id="settingsContent" class="tab-content p-6 hidden">
            <div class="space-y-6">
                <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
                    <h3 class="text-lg font-semibold text-green-700 dark:text-green-300 mb-4">☁️ การเชื่อมต่อ Google Sheets</h3>
                    <div class="space-y-4">
                        <!-- แสดงสถานะ URL แทน field -->
                        <div id="urlStatus">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">สถานะการตั้งค่า</label>
                            <div id="urlStatusText" class="p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm shadow-sm">
                                <div class="text-center">
                                    <span class="text-gray-500 dark:text-gray-400">🔄 กำลังตรวจสอบ...</span>
                                </div>
                            </div>
                            <div class="mt-3 flex justify-between items-center">
                                <button id="manageUrl" class="text-blue-500 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                    ⚙️ จัดการ URL
                                </button>
                                <button id="deleteUrl" class="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    🗑️ ลบ URL
                                </button>
                            </div>
                        </div>

                        <!-- URL field ที่ซ่อนไว้ -->
                        <div id="urlContainer" style="display: none;" class="border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Google Apps Script URL</label>
                            <input id="googleScriptUrl" type="url" placeholder="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-base">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                กด Enter เพื่อบันทึก หรือ Escape เพื่อยกเลิก
                            </p>
                            <div class="mt-3 flex gap-2">
                                <button id="saveUrl" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                    💾 บันทึก
                                </button>
                                <button id="cancelUrlEdit" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                    ❌ ยกเลิก
                                </button>
                            </div>
                        </div>

                        <!-- ปุ่มควบคุม -->
                        <div class="flex flex-col sm:flex-row gap-3">
                            <button id="testConnection" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium">
                                🔍 ทดสอบการเชื่อมต่อ
                            </button>
                            <button id="syncData" class="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors font-medium">
                                ↕️ ซิงค์ข้อมูล
                            </button>
                        </div>

                        <!-- สถานะการเชื่อมต่อ -->
                        <div id="connectionStatus" class="text-sm p-3 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <span class="text-gray-500 dark:text-gray-400">🔘 ยังไม่ได้เชื่อมต่อ</span>
                        </div>
                    </div>
                </div>
                
                <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">ตั้งค่าอัตราค่าใช้จ่าย</h3>
                
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                        <h4 class="font-semibold text-blue-700 dark:text-blue-300 mb-4">💧 อัตราค่าน้ำ</h4>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">ค่าบริการพื้นฐาน (บาท)</label>
                                <input id="waterBaseFee" type="number" step="0.01" value="8.50" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">อัตราต่อหน่วย (บาท/หน่วย)</label>
                                <input id="waterUnitRate" type="number" step="0.01" value="18.00" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base">
                            </div>
                        </div>
                    </div>

                    <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6">
                        <h4 class="font-semibold text-yellow-700 dark:text-yellow-300 mb-4">⚡ อัตราค่าไฟฟ้า</h4>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">ค่าบริการพื้นฐาน (บาท)</label>
                                <input id="electricBaseFee" type="number" step="0.01" value="38.22" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base">
                            </div>
                            <div>
                                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">อัตราต่อหน่วย (บาท/หน่วย)</label>
                                <input id="electricUnitRate" type="number" step="0.01" value="4.18" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-base">
                            </div>
                        </div>
                    </div>
                </div>

                <button id="saveSettings" class="w-full bg-primary hover:bg-purple-600 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                    💾 บันทึกการตั้งค่า
                </button>
            </div>
        </div>
    `;

    // Update content references
    contents.customers = document.getElementById('customersContent');
    contents.record = document.getElementById('recordContent');
    contents.summary = document.getElementById('summaryContent');
    contents.history = document.getElementById('historyContent');
    contents.settings = document.getElementById('settingsContent');
}

function initializeEventListeners() {
    // Customer management event listeners
    document.getElementById('addCustomer').addEventListener('click', showCustomerForm);
    document.getElementById('cancelCustomer').addEventListener('click', hideCustomerForm);
    document.getElementById('saveCustomer').addEventListener('click', saveCustomer);

    // Record tab event listeners
    document.getElementById('selectedCustomer').addEventListener('change', handleCustomerSelection);
    document.getElementById('saveWater').addEventListener('click', saveWaterReading);
    document.getElementById('saveElectric').addEventListener('click', saveElectricReading);

    // Period selection event listeners
    document.getElementById('periodType').addEventListener('change', handlePeriodTypeChange);
    document.getElementById('updatePeriod').addEventListener('click', updateCurrentUsage);
    
    // Summary event listeners
    document.getElementById('summaryPeriodType').addEventListener('change', updateSummary);
    document.getElementById('updateSummary').addEventListener('click', updateSummary);

    // History event listeners
    document.getElementById('historyCustomerFilter').addEventListener('change', updateHistoryDisplay);
    document.getElementById('clearHistory').addEventListener('click', () => {
        showConfirmDialog('คุณต้องการล้างประวัติทั้งหมดหรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้', clearAllHistory);
    });

    // Settings event listeners
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('testConnection').addEventListener('click', testGoogleSheetsConnection);
    document.getElementById('syncData').addEventListener('click', syncDataWithGoogleSheets);

    // URL Management event listeners
    const manageUrlBtn = document.getElementById('manageUrl');
    if (manageUrlBtn) {
        manageUrlBtn.addEventListener('click', manageUrl);
    }
    
    const saveUrlBtn = document.getElementById('saveUrl');
    if (saveUrlBtn) {
        saveUrlBtn.addEventListener('click', saveUrlAndHide);
    }
    
    const cancelUrlBtn = document.getElementById('cancelUrlEdit');
    if (cancelUrlBtn) {
        cancelUrlBtn.addEventListener('click', cancelUrlEdit);
    }
    
    const deleteUrlBtn = document.getElementById('deleteUrl');
    if (deleteUrlBtn) {
        deleteUrlBtn.addEventListener('click', deleteStoredUrl);
    }

    // Enter key สำหรับ URL field
    const urlField = document.getElementById('googleScriptUrl');
    if (urlField) {
        urlField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveUrlAndHide();
            } else if (e.key === 'Escape') {
                cancelUrlEdit();
            }
        });
    }

    // Modal event listeners
    document.getElementById('confirmCancel').addEventListener('click', hideConfirmDialog);
    document.getElementById('confirmOk').addEventListener('click', () => {
        if (window.confirmCallback) {
            window.confirmCallback();
        }
        hideConfirmDialog();
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabs[tabName].classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    contents[tabName].classList.remove('hidden');

    // Update displays based on the tab
    switch(tabName) {
        case 'customers':
            updateCustomersList();
            break;
        case 'record':
            updateCustomerDropdowns();
            break;
        case 'summary':
            updateSummary();
            break;
        case 'history':
            updateHistoryDisplay();
            break;
    }
}

// 🔒 ฟังก์ชันสำหรับรับ Google Script URL (ใช้ hard-coded URL ก่อน)
function getGoogleScriptUrl() {
    // ลำดับความสำคัญ: Hard-code URL > input field
    if (GOOGLE_SCRIPT_URL) {
        return GOOGLE_SCRIPT_URL;
    }
    
    // ถ้าไม่มี hard-code URL ให้ใช้จาก input field
    return document.getElementById('googleScriptUrl').value.trim();
}

// Customer Management Functions
function showCustomerForm() {
    document.getElementById('customerForm').classList.remove('hidden');
    document.getElementById('customerName').focus();
    isEditingCustomer = false;
    editingCustomerId = null;
}

function hideCustomerForm() {
    document.getElementById('customerForm').classList.add('hidden');
    // Clear form
    document.getElementById('customerName').value = '';
    document.getElementById('customerAddress').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerNote').value = '';
    isEditingCustomer = false;
    editingCustomerId = null;
}

function saveCustomer() {
    const name = document.getElementById('customerName').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const note = document.getElementById('customerNote').value.trim();

    if (!name) {
        showMessage('กรุณากรอกชื่อลูกค้า', 'error');
        return;
    }

    const customer = {
        id: isEditingCustomer ? editingCustomerId : Date.now(),
        name: name,
        address: address,
        phone: phone,
        note: note,
        createdAt: isEditingCustomer ? 
            appData.customers.find(c => c.id === editingCustomerId).createdAt : 
            new Date().toISOString()
    };

    if (isEditingCustomer) {
        const index = appData.customers.findIndex(c => c.id === editingCustomerId);
        appData.customers[index] = customer;
        showMessage('แก้ไขข้อมูลลูกค้าเรียบร้อย', 'success');
    } else {
        appData.customers.push(customer);
        // Initialize meter data for new customer
        appData.meterData[customer.id] = {
            water: [],
            electric: []
        };
        showMessage('เพิ่มลูกค้าใหม่เรียบร้อย', 'success');
    }

    hideCustomerForm();
    updateCustomersList();
    updateCustomerDropdowns();
}

function editCustomer(customerId) {
    const customer = appData.customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerAddress').value = customer.address || '';
    document.getElementById('customerPhone').value = customer.phone || '';
    document.getElementById('customerNote').value = customer.note || '';

    isEditingCustomer = true;
    editingCustomerId = customerId;
    document.getElementById('customerForm').classList.remove('hidden');
}

function deleteCustomer(customerId) {
    showConfirmDialog('คุณต้องการลบลูกค้านี้และข้อมูลทั้งหมดหรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้', () => {
        // Remove customer
        appData.customers = appData.customers.filter(c => c.id !== customerId);
        // Remove meter data
        delete appData.meterData[customerId];
        
        // If this is the selected customer, clear selection
        if (currentCustomerId === customerId) {
            currentCustomerId = null;
            document.getElementById('selectedCustomer').value = '';
            document.getElementById('meterInputs').classList.add('hidden');
        }

        updateCustomersList();
        updateCustomerDropdowns();
        updateCurrentUsage();
        updateSummary();
        updateHistoryDisplay();
        showMessage('ลบลูกค้าเรียบร้อย', 'success');
    });
}

function updateCustomersList() {
    const customersList = document.getElementById('customersList');
    
    if (appData.customers.length === 0) {
        customersList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400 py-8">ยังไม่มีข้อมูลลูกค้า</div>';
        return;
    }

    customersList.innerHTML = appData.customers.map(customer => {
        const customerData = appData.meterData[customer.id] || { water: [], electric: [] };
        const lastWaterReading = customerData.water[customerData.water.length - 1];
        const lastElectricReading = customerData.electric[customerData.electric.length - 1];

        return `
            <div class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 shadow-sm">
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-semibold text-gray-700 dark:text-gray-300">${customer.name}</h4>
                    <div class="flex space-x-1">
                        <button onclick="editCustomer(${customer.id})" class="text-blue-500 hover:text-blue-700 p-1">
                            ✏️
                        </button>
                        <button onclick="deleteCustomer(${customer.id})" class="text-red-500 hover:text-red-700 p-1">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    ${customer.address ? `<div>📍 ${customer.address}</div>` : ''}
                    ${customer.phone ? `<div>📞 ${customer.phone}</div>` : ''}
                    ${customer.note ? `<div>📝 ${customer.note}</div>` : ''}
                </div>

                <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div class="grid grid-cols-2 gap-3 text-xs">
                        <div class="text-center">
                            <div class="text-blue-600 dark:text-blue-400 font-medium">💧 น้ำ</div>
                            <div>${lastWaterReading ? lastWaterReading.meter.toFixed(2) : '-'}</div>
                        </div>
                        <div class="text-center">
                            <div class="text-yellow-600 dark:text-yellow-400 font-medium">⚡ ไฟฟ้า</div>
                            <div>${lastElectricReading ? lastElectricReading.meter.toFixed(2) : '-'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateCustomerDropdowns() {
    const selectedCustomer = document.getElementById('selectedCustomer');
    const historyFilter = document.getElementById('historyCustomerFilter');
    
    // Update record tab dropdown
    selectedCustomer.innerHTML = '<option value="">-- เลือกลูกค้า --</option>' +
        appData.customers.map(customer => 
            `<option value="${customer.id}">${customer.name} ${customer.address ? '(' + customer.address + ')' : ''}</option>`
        ).join('');

    // Update history filter dropdown
    historyFilter.innerHTML = '<option value="">-- ทุกลูกค้า --</option>' +
        appData.customers.map(customer => 
            `<option value="${customer.id}">${customer.name}</option>`
        ).join('');
}

function handleCustomerSelection() {
    const customerId = parseInt(document.getElementById('selectedCustomer').value);
    currentCustomerId = customerId || null;
    
    if (currentCustomerId) {
        document.getElementById('meterInputs').classList.remove('hidden');
        // Initialize meter data for customer if not exists
        if (!appData.meterData[currentCustomerId]) {
            appData.meterData[currentCustomerId] = {
                water: [],
                electric: []
            };
        }
        updateCurrentUsage();
    } else {
        document.getElementById('meterInputs').classList.add('hidden');
    }
}

// Meter Reading Functions
function saveWaterReading() {
    if (!currentCustomerId) {
        showMessage('กรุณาเลือกลูกค้าก่อน', 'error');
        return;
    }

    const meter = parseFloat(document.getElementById('waterMeter').value);
    const date = document.getElementById('waterDate').value;

    if (!meter || !date) {
        showMessage('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return;
    }

    const reading = {
        id: Date.now(),
        meter: meter,
        date: date,
        type: 'water',
        customerId: currentCustomerId
    };

    appData.meterData[currentCustomerId].water.push(reading);
    appData.meterData[currentCustomerId].water.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Clear form
    document.getElementById('waterMeter').value = '';
    
    updateCurrentUsage();
    updateCustomersList();
    showMessage('บันทึกข้อมูลมิเตอร์น้ำเรียบร้อย', 'success');
}

function saveElectricReading() {
    if (!currentCustomerId) {
        showMessage('กรุณาเลือกลูกค้าก่อน', 'error');
        return;
    }

    const meter = parseFloat(document.getElementById('electricMeter').value);
    const date = document.getElementById('electricDate').value;

    if (!meter || !date) {
        showMessage('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return;
    }

    const reading = {
        id: Date.now(),
        meter: meter,
        date: date,
        type: 'electric',
        customerId: currentCustomerId
    };

    appData.meterData[currentCustomerId].electric.push(reading);
    appData.meterData[currentCustomerId].electric.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Clear form
    document.getElementById('electricMeter').value = '';
    
    updateCurrentUsage();
    updateCustomersList();
    showMessage('บันทึกข้อมูลมิเตอร์ไฟฟ้าเรียบร้อย', 'success');
}

// Calculation Functions
function updateCurrentUsage() {
    if (!currentCustomerId) {
        // Reset display
        document.getElementById('waterUsage').textContent = '0';
        document.getElementById('waterCost').textContent = '฿0';
        document.getElementById('electricUsage').textContent = '0';
        document.getElementById('electricCost').textContent = '฿0';
        document.getElementById('totalCost').textContent = 'รวม: ฿0';
        updatePeriodDisplay();
        return;
    }

    const customerData = appData.meterData[currentCustomerId];
    if (!customerData) return;

    const { startDate, endDate } = getCurrentPeriod();
    
    // Calculate water usage and cost for the selected period
    const waterUsage = calculateUsageForPeriod(customerData.water, startDate, endDate);
    const waterCost = calculateWaterCost(waterUsage);
    
    // Calculate electric usage and cost for the selected period
    const electricUsage = calculateUsageForPeriod(customerData.electric, startDate, endDate);
    const electricCost = calculateElectricCost(electricUsage);

    // Update display
    document.getElementById('waterUsage').textContent = waterUsage.toFixed(2);
    document.getElementById('waterCost').textContent = `฿${waterCost.toFixed(2)}`;
    document.getElementById('electricUsage').textContent = electricUsage.toFixed(2);
    document.getElementById('electricCost').textContent = `฿${electricCost.toFixed(2)}`;
    document.getElementById('totalCost').textContent = `รวม: ฿${(waterCost + electricCost).toFixed(2)}`;
    
    // Update period display
    updatePeriodDisplay();
}

function calculateUsageForPeriod(readings, startDate, endDate) {
    if (readings.length === 0) return 0;

    // Find readings at the start and end of the period
    let startReading = null;
    let endReading = null;

    // Get the closest reading before or at the start date
    for (let i = readings.length - 1; i >= 0; i--) {
        const readingDate = new Date(readings[i].date);
        if (readingDate <= startDate) {
            startReading = readings[i];
            break;
        }
    }

    // Get the closest reading before or at the end date
    for (let i = readings.length - 1; i >= 0; i--) {
        const readingDate = new Date(readings[i].date);
        if (readingDate <= endDate) {
            endReading = readings[i];
            break;
        }
    }

    // If we have both start and end readings, calculate the difference
    if (startReading && endReading && endReading.meter >= startReading.meter) {
        return endReading.meter - startReading.meter;
    }

    // If we only have readings within the period, try to calculate
    const filteredReadings = readings.filter(reading => {
        const readingDate = new Date(reading.date);
        return readingDate >= startDate && readingDate <= endDate;
    });

    if (filteredReadings.length >= 2) {
        const firstReading = filteredReadings[0];
        const lastReading = filteredReadings[filteredReadings.length - 1];
        return Math.max(0, lastReading.meter - firstReading.meter);
    }

    return 0;
}

function updateSummary() {
    const summaryCards = document.getElementById('summaryCards');
    const periodType = document.getElementById('summaryPeriodType').value;
    const { startDate, endDate } = getPeriodDates(periodType);

    let totalWaterUsage = 0;
    let totalElectricUsage = 0;
    let grandTotalCost = 0;

    const summaryData = appData.customers.map(customer => {
        const customerData = appData.meterData[customer.id] || { water: [], electric: [] };
        
        const waterUsage = calculateUsageForPeriod(customerData.water, startDate, endDate);
        const electricUsage = calculateUsageForPeriod(customerData.electric, startDate, endDate);
        const waterCost = calculateWaterCost(waterUsage);
        const electricCost = calculateElectricCost(electricUsage);
        const totalCost = waterCost + electricCost;

        totalWaterUsage += waterUsage;
        totalElectricUsage += electricUsage;
        grandTotalCost += totalCost;

        return {
            customer,
            waterUsage,
            electricUsage,
            waterCost,
            electricCost,
            totalCost
        };
    });

    // Update summary cards
    summaryCards.innerHTML = summaryData.map(data => `
        <div class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 shadow-sm">
            <h4 class="font-semibold text-gray-700 dark:text-gray-300 mb-3">${data.customer.name}</h4>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                    <span class="text-blue-600 dark:text-blue-400">💧 น้ำ:</span>
                    <span>${data.waterUsage.toFixed(2)} หน่วย</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-yellow-600 dark:text-yellow-400">⚡ ไฟฟ้า:</span>
                    <span>${data.electricUsage.toFixed(2)} หน่วย</span>
                </div>
                <div class="flex justify-between font-semibold text-green-600 dark:text-green-400 border-t pt-2">
                    <span>💰 รวม:</span>
                    <span>฿${data.totalCost.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `).join('');

    // Update totals
    document.getElementById('totalWaterUsage').textContent = totalWaterUsage.toFixed(2);
    document.getElementById('totalElectricUsage').textContent = totalElectricUsage.toFixed(2);
    document.getElementById('grandTotal').textContent = `฿${grandTotalCost.toFixed(2)}`;
}

function getPeriodDates(periodType) {
    const today = new Date();
    let startDate, endDate;

    switch (periodType) {
        case 'current_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'last_month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'last_3_months':
            startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'last_6_months':
            startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        default:
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    return { startDate, endDate };
}

function getCurrentPeriod() {
    const periodType = document.getElementById('periodType').value;
    const today = new Date();
    let startDate, endDate;

    switch (periodType) {
        case 'current_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'last_month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'last_3_months':
            startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'last_6_months':
            startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'custom':
            startDate = new Date(document.getElementById('startDate').value || today);
            endDate = new Date(document.getElementById('endDate').value || today);
            break;
        default:
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    return { startDate, endDate };
}

function handlePeriodTypeChange() {
    const periodType = document.getElementById('periodType').value;
    const customDateStart = document.getElementById('customDateStart');
    const customDateEnd = document.getElementById('customDateEnd');

    if (periodType === 'custom') {
        customDateStart.classList.remove('hidden');
        customDateEnd.classList.remove('hidden');
        
        // Set default custom dates
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        document.getElementById('startDate').value = firstDayOfMonth.toISOString().split('T')[0];
        document.getElementById('endDate').value = today.toISOString().split('T')[0];
    } else {
        customDateStart.classList.add('hidden');
        customDateEnd.classList.add('hidden');
    }

    updateCurrentUsage();
}

function updatePeriodDisplay() {
    const periodType = document.getElementById('periodType').value;
    const { startDate, endDate } = getCurrentPeriod();
    
    const periodLabels = {
        'current_month': 'เดือนปัจจุบัน',
        'last_month': 'เดือนที่แล้ว',
        'last_3_months': '3 เดือนที่แล้ว',
        'last_6_months': '6 เดือนที่แล้ว',
        'custom': 'ช่วงที่กำหนด'
    };

    document.getElementById('periodLabel').textContent = periodLabels[periodType] || 'เดือนปัจจุบัน';
    
    const dateRange = `${startDate.toLocaleDateString('th-TH')} - ${endDate.toLocaleDateString('th-TH')}`;
    document.getElementById('periodDateRange').textContent = dateRange;
}

function calculateWaterCost(usage) {
    return appData.settings.waterBaseFee + (usage * appData.settings.waterUnitRate);
}

function calculateElectricCost(usage) {
    return appData.settings.electricBaseFee + (usage * appData.settings.electricUnitRate);
}

// History Functions
function updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    const filterCustomerId = document.getElementById('historyCustomerFilter').value;
    
    // Collect all readings from all customers
    let allReadings = [];
    Object.keys(appData.meterData).forEach(customerId => {
        const customerData = appData.meterData[customerId];
        const customer = appData.customers.find(c => c.id == customerId);
        
        if (customer) {
            // Add customer info to readings
            [...customerData.water, ...customerData.electric].forEach(reading => {
                allReadings.push({
                    ...reading,
                    customerName: customer.name,
                    customerAddress: customer.address
                });
            });
        }
    });

    // Filter by customer if selected
    if (filterCustomerId) {
        allReadings = allReadings.filter(reading => reading.customerId == filterCustomerId);
    }

    // Sort by date (newest first)
    allReadings.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allReadings.length === 0) {
        historyList.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-8">ยังไม่มีประวัติการบันทึก</div>';
        return;
    }

    historyList.innerHTML = allReadings.map(reading => {
        const typeInfo = reading.type === 'water' 
            ? { icon: '💧', name: 'น้ำ', class: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' }
            : { icon: '⚡', name: 'ไฟฟ้า', class: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' };

        return `
            <div class="border rounded-lg p-4 ${typeInfo.class}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="text-lg">${typeInfo.icon}</span>
                            <span class="font-medium text-gray-700 dark:text-gray-300">มิเตอร์${typeInfo.name}</span>
                            <span class="text-sm text-gray-500 dark:text-gray-400">- ${reading.customerName}</span>
                        </div>
                        <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <div>เลขมิเตอร์: ${reading.meter.toFixed(2)}</div>
                            <div>วันที่: ${new Date(reading.date).toLocaleDateString('th-TH')}</div>
                            ${reading.customerAddress ? `<div>📍 ${reading.customerAddress}</div>` : ''}
                        </div>
                    </div>
                    <button onclick="deleteReading(${reading.id}, '${reading.type}', ${reading.customerId})" class="text-red-500 hover:text-red-700 p-1">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function deleteReading(id, type, customerId) {
    showConfirmDialog('คุณต้องการลบข้อมูลนี้หรือไม่?', () => {
        if (appData.meterData[customerId] && appData.meterData[customerId][type]) {
            appData.meterData[customerId][type] = appData.meterData[customerId][type].filter(reading => reading.id !== id);
            updateCurrentUsage();
            updateCustomersList();
            updateSummary();
            updateHistoryDisplay();
            showMessage('ลบข้อมูลเรียบร้อย', 'success');
        }
    });
}

function clearAllHistory() {
    Object.keys(appData.meterData).forEach(customerId => {
        appData.meterData[customerId] = {
            water: [],
            electric: []
        };
    });
    updateCurrentUsage();
    updateCustomersList();
    updateSummary();
    updateHistoryDisplay();
    showMessage('ล้างประวัติทั้งหมดเรียบร้อย', 'success');
}

// Settings Functions
function loadSettings() {
    document.getElementById('waterBaseFee').value = appData.settings.waterBaseFee;
    document.getElementById('waterUnitRate').value = appData.settings.waterUnitRate;
    document.getElementById('electricBaseFee').value = appData.settings.electricBaseFee;
    document.getElementById('electricUnitRate').value = appData.settings.electricUnitRate;
}

function saveSettings() {
    appData.settings.waterBaseFee = parseFloat(document.getElementById('waterBaseFee').value) || 0;
    appData.settings.waterUnitRate = parseFloat(document.getElementById('waterUnitRate').value) || 0;
    appData.settings.electricBaseFee = parseFloat(document.getElementById('electricBaseFee').value) || 0;
    appData.settings.electricUnitRate = parseFloat(document.getElementById('electricUnitRate').value) || 0;

    updateCurrentUsage();
    updateSummary();
    showMessage('บันทึกการตั้งค่าเรียบร้อย', 'success');
}

// 🔒 Google Sheets Integration Functions (ใช้ hard-coded URL)
async function testGoogleSheetsConnection() {
    const url = getGoogleScriptUrl();
    
    if (!url) {
        showMessage('ไม่พบ Google Apps Script URL', 'error');
        return;
    }

    updateConnectionStatus('🔄 กำลังทดสอบการเชื่อมต่อ...', 'testing');

    try {
        // ลองใช้ JSONP สำหรับการทดสอบ
        const result = await makeJSONPRequest(url, { action: 'test' });
        
        if (result.success) {
            updateConnectionStatus('✅ เชื่อมต่อสำเร็จ', 'connected');
            showMessage('ทดสอบการเชื่อมต่อสำเร็จ', 'success');
        } else {
            throw new Error(result.error || 'การทดสอบล้มเหลว');
        }
    } catch (error) {
        // ถ้า JSONP ไม่ได้ผล ลองใช้ fetch แบบธรรมดา
        try {
            const response = await fetch(url + '?action=test&t=' + Date.now(), {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-cache'
            });
            
            updateConnectionStatus('✅ เชื่อมต่อสำเร็จ (no-cors)', 'connected');
            showMessage('ทดสอบการเชื่อมต่อสำเร็จ', 'success');
        } catch (fetchError) {
            updateConnectionStatus('❌ เชื่อมต่อไม่สำเร็จ: ' + error.message, 'error');
            showMessage('ไม่สามารถเชื่อมต่อได้: ' + error.message, 'error');
        }
    }
}

async function syncDataWithGoogleSheets() {
    const url = getGoogleScriptUrl();
    
    if (!url) {
        showMessage('ไม่พบ Google Apps Script URL', 'error');
        return;
    }

    updateConnectionStatus('🔄 กำลังซิงค์ข้อมูล...', 'syncing');

    try {
        // วิธีที่ 1: ลองใช้ FormData ก่อน
        const formData = new FormData();
        formData.append('data', JSON.stringify({
            action: 'save',
            data: appData
        }));

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (response.ok || response.type === 'opaque') {
            updateConnectionStatus('✅ ซิงค์ข้อมูลสำเร็จ', 'connected');
            showMessage('ซิงค์ข้อมูลสำเร็จ', 'success');
            
            // โหลดข้อมูลกลับมา
            setTimeout(() => {
                loadDataFromGoogleSheets();
            }, 1000);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

    } catch (error) {
        // วิธีที่ 2: ลองใช้ XMLHttpRequest
        try {
            await syncWithXMLHttpRequest(url);
        } catch (xhrError) {
            // วิธีที่ 3: ลองใช้ Image trick สำหรับ GET request
            try {
                await syncWithImageTrick(url);
            } catch (imgError) {
                updateConnectionStatus('❌ ซิงค์ข้อมูลไม่สำเร็จ: ' + error.message, 'error');
                showMessage('ไม่สามารถซิงค์ข้อมูลได้: ' + error.message, 'error');
            }
        }
    }
}

async function loadDataFromGoogleSheets() {
    const url = getGoogleScriptUrl();
    if (!url) return;

    try {
        // ลองใช้ JSONP ก่อน
        const result = await makeJSONPRequest(url, { action: 'load' });
        
        if (result.success && result.data) {
            // Merge ข้อมูล
            appData = { ...appData, ...result.data };
            
            // อัปเดต UI
            loadSettings();
            updateCustomersList();
            updateCustomerDropdowns();
            updateCurrentUsage();
            updateSummary();
            updateHistoryDisplay();
            
            console.log('✅ โหลดข้อมูลจาก Google Sheets สำเร็จ');
        }
    } catch (error) {
        // ถ้า JSONP ไม่ได้ผล ลองใช้ fetch no-cors
        try {
            await fetch(url + '?action=load&t=' + Date.now(), {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-cache'
            });
            console.log('โหลดข้อมูล (no-cors mode) - ไม่สามารถอ่าน response ได้');
        } catch (fetchError) {
            console.log('โหลดข้อมูลล้มเหลว:', error);
        }
    }
}

async function tryAutoLoadFromGoogleSheets() {
    await loadDataFromGoogleSheets();
}

// Helper Functions for Google Sheets
function makeJSONPRequest(url, params) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        
        // สร้าง URL พร้อม parameters
        const queryString = new URLSearchParams(params).toString();
        const requestUrl = url + '?' + queryString + '&callback=' + callbackName;
        
        // สร้าง callback function
        window[callbackName] = function(data) {
            document.head.removeChild(script);
            delete window[callbackName];
            resolve(data);
        };
        
        // สร้าง script tag
        const script = document.createElement('script');
        script.src = requestUrl;
        script.onerror = function() {
            document.head.removeChild(script);
            delete window[callbackName];
            reject(new Error('JSONP request failed'));
        };
        
        // timeout
        setTimeout(() => {
            if (window[callbackName]) {
                document.head.removeChild(script);
                delete window[callbackName];
                reject(new Error('JSONP request timeout'));
            }
        }, 10000);
        
        document.head.appendChild(script);
    });
}

function syncWithXMLHttpRequest(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                updateConnectionStatus('✅ ซิงค์ข้อมูลสำเร็จ (XHR)', 'connected');
                showMessage('ซิงค์ข้อมูลสำเร็จ', 'success');
                setTimeout(() => loadDataFromGoogleSheets(), 1000);
                resolve();
            } else {
                reject(new Error(`XHR ${xhr.status}: ${xhr.statusText}`));
            }
        };
        
        xhr.onerror = function() {
            reject(new Error('XHR network error'));
        };
        
        xhr.ontimeout = function() {
            reject(new Error('XHR timeout'));
        };
        
        xhr.timeout = 30000;
        
        // ส่งข้อมูลแบบ form-encoded
        const formData = new URLSearchParams();
        formData.append('data', JSON.stringify({
            action: 'save',
            data: appData
        }));
        
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send(formData);
    });
}

function syncWithImageTrick(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const data = encodeURIComponent(JSON.stringify({
            action: 'save',
            data: appData
        }));
        
        // สร้าง URL พร้อมข้อมูล (ถ้าข้อมูลไม่ใหญ่เกินไป)
        if (data.length > 2000) {
            reject(new Error('ข้อมูลใหญ่เกินไปสำหรับ Image trick'));
            return;
        }
        
        img.onload = function() {
            updateConnectionStatus('✅ ซิงค์ข้อมูลสำเร็จ (Image)', 'connected');
            showMessage('ซิงค์ข้อมูลสำเร็จ', 'success');
            setTimeout(() => loadDataFromGoogleSheets(), 1000);
            resolve();
        };
        
        img.onerror = function() {
            reject(new Error('Image trick failed'));
        };
        
        img.src = url + '?data=' + data + '&t=' + Date.now();
    });
}

function updateConnectionStatus(message, status) {
    const statusElement = document.getElementById('connectionStatus');
    const statusClasses = {
        'testing': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
        'syncing': 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
        'connected': 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
        'error': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
        'default': 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
    };

    statusElement.className = 'text-sm p-3 rounded-lg border border-gray-200 dark:border-gray-700 ' + (statusClasses[status] || statusClasses.default);
    statusElement.innerHTML = `<span>${message}</span>`;
}

// 🔒 URL Management Functions (แสดงสถานะ hard-coded URL)
function loadGoogleScriptUrl() {
    // ใช้ hard-coded URL ทันที
    if (GOOGLE_SCRIPT_URL) {
        document.getElementById('googleScriptUrl').value = GOOGLE_SCRIPT_URL;
        console.log('✅ ใช้ Google Script URL ที่ hard-code');
        
        // ทดสอบการเชื่อมต่ออัตโนมัติ
        setTimeout(() => {
            testGoogleSheetsConnection();
        }, 1000);
        return;
    }
}

function toggleUrlVisibility(show = false) {
    const urlContainer = document.getElementById('urlContainer');
    const urlStatus = document.getElementById('urlStatus');
    
    if (show) {
        urlContainer.style.display = 'block';
        urlStatus.style.display = 'none';
    } else {
        urlContainer.style.display = 'none';
        urlStatus.style.display = 'block';
        updateUrlStatus();
    }
}

function updateUrlStatus() {
    const statusElement = document.getElementById('urlStatusText');
    
    if (statusElement) {
        if (GOOGLE_SCRIPT_URL) {
            // แสดงเฉพาะส่วนต้นและท้ายของ URL
            let maskedUrl = '';
            if (GOOGLE_SCRIPT_URL.length > 50) {
                maskedUrl = GOOGLE_SCRIPT_URL.substring(0, 30) + '...' + GOOGLE_SCRIPT_URL.substring(GOOGLE_SCRIPT_URL.length - 15);
            } else {
                maskedUrl = GOOGLE_SCRIPT_URL.substring(0, 30) + '...';
            }
            
            statusElement.innerHTML = `
                <div class="text-center">
                    <div>
                        <span class="text-green-600 dark:text-green-400 font-medium">🔒 URL ถูกตั้งค่าแบบถาวร</span><br>
                        <span class="text-xs text-gray-500 dark:text-gray-400">${maskedUrl}</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-2">
                        URL นี้ไม่หายเมื่อเปลี่ยนเครื่อง
                    </div>
                </div>
            `;
        } else {
            statusElement.innerHTML = `
                <div class="text-center">
                    <span class="text-red-600 dark:text-red-400 font-medium">❌ ไม่พบ URL ที่ตั้งค่าไว้</span><br>
                    <span class="text-xs text-gray-500 dark:text-gray-400">กรุณาติดต่อผู้ดูแลระบบ</span>
                </div>
            `;
        }
    }
}

function manageUrl() {
    if (GOOGLE_SCRIPT_URL) {
        showMessage('URL ถูกตั้งค่าแบบถาวรแล้ว ไม่สามารถแก้ไขได้', 'error');
        return;
    }
    
    const urlField = document.getElementById('googleScriptUrl');
    toggleUrlVisibility(true);
    
    setTimeout(() => {
        urlField.focus();
    }, 100);
}

function saveUrlAndHide() {
    if (GOOGLE_SCRIPT_URL) {
        showMessage('URL ถูกตั้งค่าแบบถาวรแล้ว', 'error');
        return;
    }
    
    const url = document.getElementById('googleScriptUrl').value.trim();
    
    if (!url) {
        showMessage('กรุณากรอก Google Apps Script URL', 'error');
        return;
    }
    
    if (!url.includes('script.google.com')) {
        showMessage('URL ต้องเป็น Google Apps Script URL', 'error');
        return;
    }
    
    // บันทึก URL ใน localStorage
    localStorage.setItem('googleScriptUrl', url);
    localStorage.setItem('googleScriptUrlTimestamp', Date.now().toString());
    
    toggleUrlVisibility(false);
    showMessage('บันทึก URL เรียบร้อย', 'success');
    
    setTimeout(() => {
        testGoogleSheetsConnection();
    }, 500);
}

function cancelUrlEdit() {
    toggleUrlVisibility(false);
}

function deleteStoredUrl() {
    if (GOOGLE_SCRIPT_URL) {
        showMessage('URL ถูกตั้งค่าแบบถาวร ไม่สามารถลบได้', 'error');
        return;
    }
    
    showConfirmDialog('คุณต้องการลบ URL ที่บันทึกไว้หรือไม่?', () => {
        localStorage.removeItem('googleScriptUrl');
        localStorage.removeItem('googleScriptUrlTimestamp');
        document.getElementById('googleScriptUrl').value = '';
        updateUrlStatus();
        updateConnectionStatus('🔘 ลบ URL แล้ว', 'default');
        showMessage('ลบ URL ที่บันทึกไว้แล้ว', 'success');
    });
}

// Utility Functions
function showMessage(message, type) {
    const container = document.getElementById('messageContainer');
    const messageDiv = document.createElement('div');
    
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    messageDiv.className = `${bgColor} text-white px-4 py-2 rounded-lg shadow-lg mb-2 transform translate-x-full transition-transform duration-300`;
    messageDiv.textContent = message;

    container.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.classList.remove('translate-x-full');
    }, 100);

    setTimeout(() => {
        messageDiv.classList.add('translate-x-full');
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 3000);
}

function showConfirmDialog(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.remove('hidden');
    window.confirmCallback = callback;
}

function hideConfirmDialog() {
    document.getElementById('confirmModal').classList.add('hidden');
    window.confirmCallback = null;
}

// Global functions for onclick handlers
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.deleteReading = deleteReading;