// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class LEn extends L {
  LEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Business Hub';

  @override
  String get navHome => 'Home';

  @override
  String get navStock => 'Stock';

  @override
  String get navClients => 'Clients';

  @override
  String get navHistory => 'History';

  @override
  String get navPos => 'POS';

  @override
  String get actionSave => 'Save';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionDelete => 'Delete';

  @override
  String get actionEdit => 'Edit';

  @override
  String get actionAdd => 'Add';

  @override
  String get actionDone => 'Done';

  @override
  String get actionRetry => 'Retry';

  @override
  String get actionRefresh => 'Refresh';

  @override
  String get actionClear => 'Clear';

  @override
  String get actionApply => 'Apply';

  @override
  String get actionShare => 'Share';

  @override
  String get actionPrint => 'Print';

  @override
  String get actionContinue => 'Continue';

  @override
  String get actionBack => 'Back';

  @override
  String get actionSearch => 'Search';

  @override
  String get labelTotal => 'Total';

  @override
  String get labelSubtotal => 'Subtotal';

  @override
  String get labelPaid => 'Paid';

  @override
  String get labelDue => 'Due';

  @override
  String get labelBalanceDue => 'Balance due';

  @override
  String get labelDiscount => 'Discount';

  @override
  String get labelCustomer => 'Customer';

  @override
  String get labelMobile => 'Mobile';

  @override
  String get labelQuantity => 'Quantity';

  @override
  String get labelPrice => 'Price';

  @override
  String get labelStock => 'Stock';

  @override
  String get labelCategory => 'Category';

  @override
  String get labelDate => 'Date';

  @override
  String get labelPayment => 'Payment';

  @override
  String get labelNotes => 'Notes';

  @override
  String get labelName => 'Name';

  @override
  String get labelOptional => 'optional';

  @override
  String get payCash => 'Cash';

  @override
  String get payUpi => 'UPI';

  @override
  String get payCard => 'Card';

  @override
  String get payCredit => 'Credit';

  @override
  String get paySplit => 'Split';

  @override
  String get posTitle => 'Point of Sale';

  @override
  String get posSearchHint => 'Search by name, SKU or barcode';

  @override
  String get posCartEmpty => 'Cart is empty';

  @override
  String get posCheckout => 'Checkout';

  @override
  String get posCompleteSale => 'Complete sale';

  @override
  String posSaveWithDue(String amount) {
    return 'Save with $amount due';
  }

  @override
  String get posAddDiscount => 'Add discount';

  @override
  String posDiscountOff(String amount) {
    return '-$amount off';
  }

  @override
  String get posAddSplit => 'Add split';

  @override
  String get posScanToPay => 'Scan to pay';

  @override
  String get posShowUpiQr => 'Show UPI QR';

  @override
  String posSaleSaved(String amount) {
    return 'Sale saved: $amount';
  }

  @override
  String get posChange => 'Change';

  @override
  String get posCustomItem => 'Custom';

  @override
  String get posBuyerGstin => 'Buyer GSTIN (optional)';

  @override
  String get invTitle => 'Inventory';

  @override
  String get invSearchHint => 'Search inventory...';

  @override
  String get invAddItem => 'Add Item';

  @override
  String get invEditItem => 'Edit Item';

  @override
  String get invNewItem => 'Add New Item';

  @override
  String get invLowStock => 'Low stock';

  @override
  String get invRestock => 'Restock';

  @override
  String get invAddStock => 'Add stock';

  @override
  String get invAll => 'All';

  @override
  String get invOutOfStock => 'Out of stock';

  @override
  String get invInStock => 'OK';

  @override
  String invItemSaved(String name) {
    return '$name saved.';
  }

  @override
  String get invTakePhoto => 'Take photo';

  @override
  String get invChooseGallery => 'Choose from gallery';

  @override
  String get invRemovePhoto => 'Remove photo';

  @override
  String get custTitle => 'Clients';

  @override
  String get custAdd => 'Add customer';

  @override
  String get custBalance => 'Balance';

  @override
  String get custOutstanding => 'Outstanding';

  @override
  String get custRemind => 'Send reminder';

  @override
  String get custNoCustomers => 'No customers yet';

  @override
  String get custSearchHint => 'Search customers...';

  @override
  String get custKhata => 'Khata';

  @override
  String get histTitle => 'History';

  @override
  String get histReceipts => 'Receipts';

  @override
  String get histGross => 'Gross';

  @override
  String get histSearchHint => 'Find receipts';

  @override
  String get histWalkIn => 'Walk-in customer';

  @override
  String get histRefund => 'Return / refund';

  @override
  String get histRefunded => 'REFUNDED';

  @override
  String get histSynced => 'SYNCED';

  @override
  String get histQueued => 'QUEUED';

  @override
  String get histTapDetail => 'Tap for detail';

  @override
  String get histShareReceipt => 'Share receipt';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsBusiness => 'Business details';

  @override
  String get settingsStaff => 'Staff & PINs';

  @override
  String get settingsTeam => 'Team';

  @override
  String get settingsExpenses => 'Expenses';

  @override
  String get settingsPurchases => 'Suppliers & purchases';

  @override
  String get settingsBackup => 'Backup & restore';

  @override
  String get settingsImport => 'Import data';

  @override
  String get settingsSecurity => 'Security';

  @override
  String get settingsPlanBilling => 'Plan & billing';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsLanguageSubtitle => 'App display language';

  @override
  String get settingsSignOut => 'Sign out';

  @override
  String get langEnglish => 'English';

  @override
  String get langHindi => 'हिन्दी (Hindi)';

  @override
  String get langGujarati => 'ગુજરાતી (Gujarati)';

  @override
  String get langChanged => 'Language updated.';

  @override
  String get errGeneric => 'Something went wrong. Please try again.';

  @override
  String get errOffline => 'You are offline. Changes are saved on this device.';

  @override
  String get errRequired => 'This field is required';

  @override
  String get errInvalidNumber => 'Enter a valid number';

  @override
  String get commonYes => 'Yes';

  @override
  String get commonNo => 'No';

  @override
  String get commonToday => 'Today';

  @override
  String get commonYesterday => 'Yesterday';

  @override
  String get commonThisWeek => 'This week';

  @override
  String get commonThisMonth => 'This month';

  @override
  String get commonAllTime => 'All time';

  @override
  String get settingsShop => 'Shop';

  @override
  String get settingsManage => 'MANAGE';

  @override
  String get settingsBusinessSub => 'Name, receipt footer, currency';

  @override
  String get settingsStaffSub => 'Accounts, roles and personal PINs';

  @override
  String get settingsTeamSub => 'Workspace members (cloud)';

  @override
  String get settingsSwitchShop => 'Switch shop';

  @override
  String get settingsSwitchShopSub => 'Change the active workspace';

  @override
  String get settingsAttendance => 'Attendance';

  @override
  String get settingsAttendanceSub => 'Clock-in and shift records';

  @override
  String get settingsExpensesSub => 'Track shop spending';

  @override
  String get settingsPurchasesSub => 'Stock buying and supplier dues';

  @override
  String get settingsPlanBillingSub => 'Your plan, renewals and payment';

  @override
  String get settingsComparePlans => 'Compare plans';

  @override
  String get settingsComparePlansSub => 'What each plan unlocks';

  @override
  String get settingsBackupSub => 'Protect your books from data loss';

  @override
  String get settingsImportSub => 'Migrate from Zobaze (.xlsx)';

  @override
  String get settingsChangePin => 'Change PIN';

  @override
  String get settingsChangePinSub => 'Update your unlock PIN';

  @override
  String get settingsSecuritySub => 'App lock and MFA';

  @override
  String get settingsSync => 'Sync';

  @override
  String get settingsAdminTools => 'Admin tools';

  @override
  String get settingsAdminToolsSub => 'Pulse, devices and operations';

  @override
  String get settingsRole => 'Role';

  @override
  String get settingsSignedIn => 'Signed in';

  @override
  String get dashLowStock => 'Low stock';

  @override
  String get dashManage => 'Manage';

  @override
  String get dashWalkInSale => 'Walk-in sale';

  @override
  String dashLeft(String count) {
    return '$count left';
  }

  @override
  String get dashRecentSales => 'Recent sales';

  @override
  String get dashTodaySales => 'Today\'s sales';

  @override
  String get dashViewAll => 'View all';

  @override
  String get collectTitle => 'Collect udhaar';

  @override
  String get collectTotalOutstanding => 'TOTAL OUTSTANDING';

  @override
  String get collectRemindAll => 'Remind all';

  @override
  String get collectOnlyOverdue => 'Only overdue';

  @override
  String get reorderTitle => 'Reorder list';

  @override
  String get reorderSendOrder => 'Send order';

  @override
  String get reorderOutOfStock => 'OUT OF STOCK';

  @override
  String get reorderSupplierPhone => 'Supplier mobile number';

  @override
  String get expAdd => 'Add expense';

  @override
  String get expDetails => 'Expense details';

  @override
  String get expTotal => 'Total spent';

  @override
  String get purSuppliers => 'Suppliers & purchases';

  @override
  String get purOutstanding => 'Outstanding to suppliers';

  @override
  String get purRecent => 'Recent purchases';

  @override
  String get purAdd => 'Add purchase';

  @override
  String get backupTitle => 'Backup & restore';

  @override
  String get backupSaved => 'Saved backups';

  @override
  String get teamTitle => 'Workspace team';

  @override
  String get teamInvite => 'Invite member';

  @override
  String get billingTitle => 'Plan & billing';

  @override
  String get billingChoosePlan => 'CHOOSE A PLAN';

  @override
  String get billingPaid => 'I have paid - Refresh';

  @override
  String get healthTitle => 'Data health';

  @override
  String get healthNothing => 'Nothing to fix';

  @override
  String get healthDuplicates => 'Duplicate products';

  @override
  String get healthMerge => 'Merge';

  @override
  String get healthMergeAll => 'Merge all';

  @override
  String get deadStockTitle => 'Dead stock';

  @override
  String get deadStockMoney => 'MONEY SITTING ON THE SHELF';

  @override
  String get deadNeverSold => 'Never sold';

  @override
  String get reportsTitle => 'Reports';

  @override
  String get reportsProfit => 'Profit';

  @override
  String get reportsBestSellers => 'Best sellers';

  @override
  String get reportsCashFlow => 'Cash flow';

  @override
  String get reportsMoneyIn => 'Money in';

  @override
  String get reportsMoneyOut => 'Money out';

  @override
  String get reportsNet => 'Net';

  @override
  String get staffPerformance => 'Staff performance';

  @override
  String get staffSoldBy => 'Sold by';

  @override
  String get welcomeTitle => 'Welcome to Business Hub';

  @override
  String get welcomeSetup => 'Set up your shop';

  @override
  String get welcomeSkip => 'Skip for now';

  @override
  String get welcomeFinish => 'Finish setup';

  @override
  String get posFavourites => 'Favourites';
}
