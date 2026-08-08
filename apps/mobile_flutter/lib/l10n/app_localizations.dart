import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_gu.dart';
import 'app_localizations_hi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of L
/// returned by `L.of(context)`.
///
/// Applications need to include `L.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: L.localizationsDelegates,
///   supportedLocales: L.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the L.supportedLocales
/// property.
abstract class L {
  L(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static L of(BuildContext context) {
    return Localizations.of<L>(context, L)!;
  }

  static const LocalizationsDelegate<L> delegate = _LDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('gu'),
    Locale('hi'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'Business Hub'**
  String get appName;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navStock.
  ///
  /// In en, this message translates to:
  /// **'Stock'**
  String get navStock;

  /// No description provided for @navClients.
  ///
  /// In en, this message translates to:
  /// **'Clients'**
  String get navClients;

  /// No description provided for @navHistory.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get navHistory;

  /// No description provided for @navPos.
  ///
  /// In en, this message translates to:
  /// **'POS'**
  String get navPos;

  /// No description provided for @actionSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get actionSave;

  /// No description provided for @actionCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get actionCancel;

  /// No description provided for @actionDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get actionDelete;

  /// No description provided for @actionEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get actionEdit;

  /// No description provided for @actionAdd.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get actionAdd;

  /// No description provided for @actionDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get actionDone;

  /// No description provided for @actionRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get actionRetry;

  /// No description provided for @actionRefresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get actionRefresh;

  /// No description provided for @actionClear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get actionClear;

  /// No description provided for @actionApply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get actionApply;

  /// No description provided for @actionShare.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get actionShare;

  /// No description provided for @actionPrint.
  ///
  /// In en, this message translates to:
  /// **'Print'**
  String get actionPrint;

  /// No description provided for @actionContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get actionContinue;

  /// No description provided for @actionBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get actionBack;

  /// No description provided for @actionSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get actionSearch;

  /// No description provided for @labelTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get labelTotal;

  /// No description provided for @labelSubtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get labelSubtotal;

  /// No description provided for @labelPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get labelPaid;

  /// No description provided for @labelDue.
  ///
  /// In en, this message translates to:
  /// **'Due'**
  String get labelDue;

  /// No description provided for @labelBalanceDue.
  ///
  /// In en, this message translates to:
  /// **'Balance due'**
  String get labelBalanceDue;

  /// No description provided for @labelDiscount.
  ///
  /// In en, this message translates to:
  /// **'Discount'**
  String get labelDiscount;

  /// No description provided for @labelCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get labelCustomer;

  /// No description provided for @labelMobile.
  ///
  /// In en, this message translates to:
  /// **'Mobile'**
  String get labelMobile;

  /// No description provided for @labelQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get labelQuantity;

  /// No description provided for @labelPrice.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get labelPrice;

  /// No description provided for @labelStock.
  ///
  /// In en, this message translates to:
  /// **'Stock'**
  String get labelStock;

  /// No description provided for @labelCategory.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get labelCategory;

  /// No description provided for @labelDate.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get labelDate;

  /// No description provided for @labelPayment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get labelPayment;

  /// No description provided for @labelNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get labelNotes;

  /// No description provided for @labelName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get labelName;

  /// No description provided for @labelOptional.
  ///
  /// In en, this message translates to:
  /// **'optional'**
  String get labelOptional;

  /// No description provided for @payCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get payCash;

  /// No description provided for @payUpi.
  ///
  /// In en, this message translates to:
  /// **'UPI'**
  String get payUpi;

  /// No description provided for @payCard.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get payCard;

  /// No description provided for @payCredit.
  ///
  /// In en, this message translates to:
  /// **'Credit'**
  String get payCredit;

  /// No description provided for @paySplit.
  ///
  /// In en, this message translates to:
  /// **'Split'**
  String get paySplit;

  /// No description provided for @posTitle.
  ///
  /// In en, this message translates to:
  /// **'Point of Sale'**
  String get posTitle;

  /// No description provided for @posSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search by name, SKU or barcode'**
  String get posSearchHint;

  /// No description provided for @posCartEmpty.
  ///
  /// In en, this message translates to:
  /// **'Cart is empty'**
  String get posCartEmpty;

  /// No description provided for @posCheckout.
  ///
  /// In en, this message translates to:
  /// **'Checkout'**
  String get posCheckout;

  /// No description provided for @posCompleteSale.
  ///
  /// In en, this message translates to:
  /// **'Complete sale'**
  String get posCompleteSale;

  /// No description provided for @posSaveWithDue.
  ///
  /// In en, this message translates to:
  /// **'Save with {amount} due'**
  String posSaveWithDue(String amount);

  /// No description provided for @posAddDiscount.
  ///
  /// In en, this message translates to:
  /// **'Add discount'**
  String get posAddDiscount;

  /// No description provided for @posDiscountOff.
  ///
  /// In en, this message translates to:
  /// **'-{amount} off'**
  String posDiscountOff(String amount);

  /// No description provided for @posAddSplit.
  ///
  /// In en, this message translates to:
  /// **'Add split'**
  String get posAddSplit;

  /// No description provided for @posScanToPay.
  ///
  /// In en, this message translates to:
  /// **'Scan to pay'**
  String get posScanToPay;

  /// No description provided for @posShowUpiQr.
  ///
  /// In en, this message translates to:
  /// **'Show UPI QR'**
  String get posShowUpiQr;

  /// No description provided for @posSaleSaved.
  ///
  /// In en, this message translates to:
  /// **'Sale saved: {amount}'**
  String posSaleSaved(String amount);

  /// No description provided for @posChange.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get posChange;

  /// No description provided for @posCustomItem.
  ///
  /// In en, this message translates to:
  /// **'Custom'**
  String get posCustomItem;

  /// No description provided for @posBuyerGstin.
  ///
  /// In en, this message translates to:
  /// **'Buyer GSTIN (optional)'**
  String get posBuyerGstin;

  /// No description provided for @invTitle.
  ///
  /// In en, this message translates to:
  /// **'Inventory'**
  String get invTitle;

  /// No description provided for @invSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search inventory...'**
  String get invSearchHint;

  /// No description provided for @invAddItem.
  ///
  /// In en, this message translates to:
  /// **'Add Item'**
  String get invAddItem;

  /// No description provided for @invEditItem.
  ///
  /// In en, this message translates to:
  /// **'Edit Item'**
  String get invEditItem;

  /// No description provided for @invNewItem.
  ///
  /// In en, this message translates to:
  /// **'Add New Item'**
  String get invNewItem;

  /// No description provided for @invLowStock.
  ///
  /// In en, this message translates to:
  /// **'Low stock'**
  String get invLowStock;

  /// No description provided for @invRestock.
  ///
  /// In en, this message translates to:
  /// **'Restock'**
  String get invRestock;

  /// No description provided for @invAddStock.
  ///
  /// In en, this message translates to:
  /// **'Add stock'**
  String get invAddStock;

  /// No description provided for @invAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get invAll;

  /// No description provided for @invOutOfStock.
  ///
  /// In en, this message translates to:
  /// **'Out of stock'**
  String get invOutOfStock;

  /// No description provided for @invInStock.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get invInStock;

  /// No description provided for @invItemSaved.
  ///
  /// In en, this message translates to:
  /// **'{name} saved.'**
  String invItemSaved(String name);

  /// No description provided for @invTakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get invTakePhoto;

  /// No description provided for @invChooseGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get invChooseGallery;

  /// No description provided for @invRemovePhoto.
  ///
  /// In en, this message translates to:
  /// **'Remove photo'**
  String get invRemovePhoto;

  /// No description provided for @custTitle.
  ///
  /// In en, this message translates to:
  /// **'Clients'**
  String get custTitle;

  /// No description provided for @custAdd.
  ///
  /// In en, this message translates to:
  /// **'Add customer'**
  String get custAdd;

  /// No description provided for @custBalance.
  ///
  /// In en, this message translates to:
  /// **'Balance'**
  String get custBalance;

  /// No description provided for @custOutstanding.
  ///
  /// In en, this message translates to:
  /// **'Outstanding'**
  String get custOutstanding;

  /// No description provided for @custRemind.
  ///
  /// In en, this message translates to:
  /// **'Send reminder'**
  String get custRemind;

  /// No description provided for @custNoCustomers.
  ///
  /// In en, this message translates to:
  /// **'No customers yet'**
  String get custNoCustomers;

  /// No description provided for @custSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search customers...'**
  String get custSearchHint;

  /// No description provided for @custKhata.
  ///
  /// In en, this message translates to:
  /// **'Khata'**
  String get custKhata;

  /// No description provided for @histTitle.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get histTitle;

  /// No description provided for @histReceipts.
  ///
  /// In en, this message translates to:
  /// **'Receipts'**
  String get histReceipts;

  /// No description provided for @histGross.
  ///
  /// In en, this message translates to:
  /// **'Gross'**
  String get histGross;

  /// No description provided for @histSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Find receipts'**
  String get histSearchHint;

  /// No description provided for @histWalkIn.
  ///
  /// In en, this message translates to:
  /// **'Walk-in customer'**
  String get histWalkIn;

  /// No description provided for @histRefund.
  ///
  /// In en, this message translates to:
  /// **'Return / refund'**
  String get histRefund;

  /// No description provided for @histRefunded.
  ///
  /// In en, this message translates to:
  /// **'REFUNDED'**
  String get histRefunded;

  /// No description provided for @histSynced.
  ///
  /// In en, this message translates to:
  /// **'SYNCED'**
  String get histSynced;

  /// No description provided for @histQueued.
  ///
  /// In en, this message translates to:
  /// **'QUEUED'**
  String get histQueued;

  /// No description provided for @histTapDetail.
  ///
  /// In en, this message translates to:
  /// **'Tap for detail'**
  String get histTapDetail;

  /// No description provided for @histShareReceipt.
  ///
  /// In en, this message translates to:
  /// **'Share receipt'**
  String get histShareReceipt;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @settingsBusiness.
  ///
  /// In en, this message translates to:
  /// **'Business details'**
  String get settingsBusiness;

  /// No description provided for @settingsStaff.
  ///
  /// In en, this message translates to:
  /// **'Staff & PINs'**
  String get settingsStaff;

  /// No description provided for @settingsTeam.
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get settingsTeam;

  /// No description provided for @settingsExpenses.
  ///
  /// In en, this message translates to:
  /// **'Expenses'**
  String get settingsExpenses;

  /// No description provided for @settingsPurchases.
  ///
  /// In en, this message translates to:
  /// **'Suppliers & purchases'**
  String get settingsPurchases;

  /// No description provided for @settingsBackup.
  ///
  /// In en, this message translates to:
  /// **'Backup & restore'**
  String get settingsBackup;

  /// No description provided for @settingsImport.
  ///
  /// In en, this message translates to:
  /// **'Import data'**
  String get settingsImport;

  /// No description provided for @settingsSecurity.
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get settingsSecurity;

  /// No description provided for @settingsPlanBilling.
  ///
  /// In en, this message translates to:
  /// **'Plan & billing'**
  String get settingsPlanBilling;

  /// No description provided for @settingsLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settingsLanguage;

  /// No description provided for @settingsLanguageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'App display language'**
  String get settingsLanguageSubtitle;

  /// No description provided for @settingsSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get settingsSignOut;

  /// No description provided for @langEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get langEnglish;

  /// No description provided for @langHindi.
  ///
  /// In en, this message translates to:
  /// **'हिन्दी (Hindi)'**
  String get langHindi;

  /// No description provided for @langGujarati.
  ///
  /// In en, this message translates to:
  /// **'ગુજરાતી (Gujarati)'**
  String get langGujarati;

  /// No description provided for @langChanged.
  ///
  /// In en, this message translates to:
  /// **'Language updated.'**
  String get langChanged;

  /// No description provided for @errGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errGeneric;

  /// No description provided for @errOffline.
  ///
  /// In en, this message translates to:
  /// **'You are offline. Changes are saved on this device.'**
  String get errOffline;

  /// No description provided for @errRequired.
  ///
  /// In en, this message translates to:
  /// **'This field is required'**
  String get errRequired;

  /// No description provided for @errInvalidNumber.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid number'**
  String get errInvalidNumber;

  /// No description provided for @commonYes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get commonYes;

  /// No description provided for @commonNo.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get commonNo;

  /// No description provided for @commonToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get commonToday;

  /// No description provided for @commonYesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get commonYesterday;

  /// No description provided for @commonThisWeek.
  ///
  /// In en, this message translates to:
  /// **'This week'**
  String get commonThisWeek;

  /// No description provided for @commonThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get commonThisMonth;

  /// No description provided for @commonAllTime.
  ///
  /// In en, this message translates to:
  /// **'All time'**
  String get commonAllTime;

  /// No description provided for @settingsShop.
  ///
  /// In en, this message translates to:
  /// **'Shop'**
  String get settingsShop;

  /// No description provided for @settingsManage.
  ///
  /// In en, this message translates to:
  /// **'MANAGE'**
  String get settingsManage;

  /// No description provided for @settingsBusinessSub.
  ///
  /// In en, this message translates to:
  /// **'Name, receipt footer, currency'**
  String get settingsBusinessSub;

  /// No description provided for @settingsStaffSub.
  ///
  /// In en, this message translates to:
  /// **'Accounts, roles and personal PINs'**
  String get settingsStaffSub;

  /// No description provided for @settingsTeamSub.
  ///
  /// In en, this message translates to:
  /// **'Workspace members (cloud)'**
  String get settingsTeamSub;

  /// No description provided for @settingsSwitchShop.
  ///
  /// In en, this message translates to:
  /// **'Switch shop'**
  String get settingsSwitchShop;

  /// No description provided for @settingsSwitchShopSub.
  ///
  /// In en, this message translates to:
  /// **'Change the active workspace'**
  String get settingsSwitchShopSub;

  /// No description provided for @settingsAttendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get settingsAttendance;

  /// No description provided for @settingsAttendanceSub.
  ///
  /// In en, this message translates to:
  /// **'Clock-in and shift records'**
  String get settingsAttendanceSub;

  /// No description provided for @settingsExpensesSub.
  ///
  /// In en, this message translates to:
  /// **'Track shop spending'**
  String get settingsExpensesSub;

  /// No description provided for @settingsPurchasesSub.
  ///
  /// In en, this message translates to:
  /// **'Stock buying and supplier dues'**
  String get settingsPurchasesSub;

  /// No description provided for @settingsPlanBillingSub.
  ///
  /// In en, this message translates to:
  /// **'Your plan, renewals and payment'**
  String get settingsPlanBillingSub;

  /// No description provided for @settingsComparePlans.
  ///
  /// In en, this message translates to:
  /// **'Compare plans'**
  String get settingsComparePlans;

  /// No description provided for @settingsComparePlansSub.
  ///
  /// In en, this message translates to:
  /// **'What each plan unlocks'**
  String get settingsComparePlansSub;

  /// No description provided for @settingsBackupSub.
  ///
  /// In en, this message translates to:
  /// **'Protect your books from data loss'**
  String get settingsBackupSub;

  /// No description provided for @settingsImportSub.
  ///
  /// In en, this message translates to:
  /// **'Migrate from Zobaze (.xlsx)'**
  String get settingsImportSub;

  /// No description provided for @settingsChangePin.
  ///
  /// In en, this message translates to:
  /// **'Change PIN'**
  String get settingsChangePin;

  /// No description provided for @settingsChangePinSub.
  ///
  /// In en, this message translates to:
  /// **'Update your unlock PIN'**
  String get settingsChangePinSub;

  /// No description provided for @settingsSecuritySub.
  ///
  /// In en, this message translates to:
  /// **'App lock and MFA'**
  String get settingsSecuritySub;

  /// No description provided for @settingsSync.
  ///
  /// In en, this message translates to:
  /// **'Sync'**
  String get settingsSync;

  /// No description provided for @settingsAdminTools.
  ///
  /// In en, this message translates to:
  /// **'Admin tools'**
  String get settingsAdminTools;

  /// No description provided for @settingsAdminToolsSub.
  ///
  /// In en, this message translates to:
  /// **'Pulse, devices and operations'**
  String get settingsAdminToolsSub;

  /// No description provided for @settingsRole.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get settingsRole;

  /// No description provided for @settingsSignedIn.
  ///
  /// In en, this message translates to:
  /// **'Signed in'**
  String get settingsSignedIn;

  /// No description provided for @dashLowStock.
  ///
  /// In en, this message translates to:
  /// **'Low stock'**
  String get dashLowStock;

  /// No description provided for @dashManage.
  ///
  /// In en, this message translates to:
  /// **'Manage'**
  String get dashManage;

  /// No description provided for @dashWalkInSale.
  ///
  /// In en, this message translates to:
  /// **'Walk-in sale'**
  String get dashWalkInSale;

  /// No description provided for @dashLeft.
  ///
  /// In en, this message translates to:
  /// **'{count} left'**
  String dashLeft(String count);

  /// No description provided for @dashRecentSales.
  ///
  /// In en, this message translates to:
  /// **'Recent sales'**
  String get dashRecentSales;

  /// No description provided for @dashTodaySales.
  ///
  /// In en, this message translates to:
  /// **'Today\'s sales'**
  String get dashTodaySales;

  /// No description provided for @dashViewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get dashViewAll;

  /// No description provided for @collectTitle.
  ///
  /// In en, this message translates to:
  /// **'Collect udhaar'**
  String get collectTitle;

  /// No description provided for @collectTotalOutstanding.
  ///
  /// In en, this message translates to:
  /// **'TOTAL OUTSTANDING'**
  String get collectTotalOutstanding;

  /// No description provided for @collectRemindAll.
  ///
  /// In en, this message translates to:
  /// **'Remind all'**
  String get collectRemindAll;

  /// No description provided for @collectOnlyOverdue.
  ///
  /// In en, this message translates to:
  /// **'Only overdue'**
  String get collectOnlyOverdue;

  /// No description provided for @reorderTitle.
  ///
  /// In en, this message translates to:
  /// **'Reorder list'**
  String get reorderTitle;

  /// No description provided for @reorderSendOrder.
  ///
  /// In en, this message translates to:
  /// **'Send order'**
  String get reorderSendOrder;

  /// No description provided for @reorderOutOfStock.
  ///
  /// In en, this message translates to:
  /// **'OUT OF STOCK'**
  String get reorderOutOfStock;

  /// No description provided for @reorderSupplierPhone.
  ///
  /// In en, this message translates to:
  /// **'Supplier mobile number'**
  String get reorderSupplierPhone;

  /// No description provided for @expAdd.
  ///
  /// In en, this message translates to:
  /// **'Add expense'**
  String get expAdd;

  /// No description provided for @expDetails.
  ///
  /// In en, this message translates to:
  /// **'Expense details'**
  String get expDetails;

  /// No description provided for @expTotal.
  ///
  /// In en, this message translates to:
  /// **'Total spent'**
  String get expTotal;

  /// No description provided for @purSuppliers.
  ///
  /// In en, this message translates to:
  /// **'Suppliers & purchases'**
  String get purSuppliers;

  /// No description provided for @purOutstanding.
  ///
  /// In en, this message translates to:
  /// **'Outstanding to suppliers'**
  String get purOutstanding;

  /// No description provided for @purRecent.
  ///
  /// In en, this message translates to:
  /// **'Recent purchases'**
  String get purRecent;

  /// No description provided for @purAdd.
  ///
  /// In en, this message translates to:
  /// **'Add purchase'**
  String get purAdd;

  /// No description provided for @backupTitle.
  ///
  /// In en, this message translates to:
  /// **'Backup & restore'**
  String get backupTitle;

  /// No description provided for @backupSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved backups'**
  String get backupSaved;

  /// No description provided for @teamTitle.
  ///
  /// In en, this message translates to:
  /// **'Workspace team'**
  String get teamTitle;

  /// No description provided for @teamInvite.
  ///
  /// In en, this message translates to:
  /// **'Invite member'**
  String get teamInvite;

  /// No description provided for @billingTitle.
  ///
  /// In en, this message translates to:
  /// **'Plan & billing'**
  String get billingTitle;

  /// No description provided for @billingChoosePlan.
  ///
  /// In en, this message translates to:
  /// **'CHOOSE A PLAN'**
  String get billingChoosePlan;

  /// No description provided for @billingPaid.
  ///
  /// In en, this message translates to:
  /// **'I have paid - Refresh'**
  String get billingPaid;

  /// No description provided for @healthTitle.
  ///
  /// In en, this message translates to:
  /// **'Data health'**
  String get healthTitle;

  /// No description provided for @healthNothing.
  ///
  /// In en, this message translates to:
  /// **'Nothing to fix'**
  String get healthNothing;

  /// No description provided for @healthDuplicates.
  ///
  /// In en, this message translates to:
  /// **'Duplicate products'**
  String get healthDuplicates;

  /// No description provided for @healthMerge.
  ///
  /// In en, this message translates to:
  /// **'Merge'**
  String get healthMerge;

  /// No description provided for @healthMergeAll.
  ///
  /// In en, this message translates to:
  /// **'Merge all'**
  String get healthMergeAll;

  /// No description provided for @deadStockTitle.
  ///
  /// In en, this message translates to:
  /// **'Dead stock'**
  String get deadStockTitle;

  /// No description provided for @deadStockMoney.
  ///
  /// In en, this message translates to:
  /// **'MONEY SITTING ON THE SHELF'**
  String get deadStockMoney;

  /// No description provided for @deadNeverSold.
  ///
  /// In en, this message translates to:
  /// **'Never sold'**
  String get deadNeverSold;

  /// No description provided for @reportsTitle.
  ///
  /// In en, this message translates to:
  /// **'Reports'**
  String get reportsTitle;

  /// No description provided for @reportsProfit.
  ///
  /// In en, this message translates to:
  /// **'Profit'**
  String get reportsProfit;

  /// No description provided for @reportsBestSellers.
  ///
  /// In en, this message translates to:
  /// **'Best sellers'**
  String get reportsBestSellers;

  /// No description provided for @reportsCashFlow.
  ///
  /// In en, this message translates to:
  /// **'Cash flow'**
  String get reportsCashFlow;

  /// No description provided for @reportsMoneyIn.
  ///
  /// In en, this message translates to:
  /// **'Money in'**
  String get reportsMoneyIn;

  /// No description provided for @reportsMoneyOut.
  ///
  /// In en, this message translates to:
  /// **'Money out'**
  String get reportsMoneyOut;

  /// No description provided for @reportsNet.
  ///
  /// In en, this message translates to:
  /// **'Net'**
  String get reportsNet;

  /// No description provided for @staffPerformance.
  ///
  /// In en, this message translates to:
  /// **'Staff performance'**
  String get staffPerformance;

  /// No description provided for @staffSoldBy.
  ///
  /// In en, this message translates to:
  /// **'Sold by'**
  String get staffSoldBy;

  /// No description provided for @welcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome to Business Hub'**
  String get welcomeTitle;

  /// No description provided for @welcomeSetup.
  ///
  /// In en, this message translates to:
  /// **'Set up your shop'**
  String get welcomeSetup;

  /// No description provided for @welcomeSkip.
  ///
  /// In en, this message translates to:
  /// **'Skip for now'**
  String get welcomeSkip;

  /// No description provided for @welcomeFinish.
  ///
  /// In en, this message translates to:
  /// **'Finish setup'**
  String get welcomeFinish;

  /// No description provided for @posFavourites.
  ///
  /// In en, this message translates to:
  /// **'Favourites'**
  String get posFavourites;
}

class _LDelegate extends LocalizationsDelegate<L> {
  const _LDelegate();

  @override
  Future<L> load(Locale locale) {
    return SynchronousFuture<L>(lookupL(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'gu', 'hi'].contains(locale.languageCode);

  @override
  bool shouldReload(_LDelegate old) => false;
}

L lookupL(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return LEn();
    case 'gu':
      return LGu();
    case 'hi':
      return LHi();
  }

  throw FlutterError(
    'L.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
