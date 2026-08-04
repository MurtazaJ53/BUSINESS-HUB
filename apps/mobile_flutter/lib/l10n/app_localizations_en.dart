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
}
