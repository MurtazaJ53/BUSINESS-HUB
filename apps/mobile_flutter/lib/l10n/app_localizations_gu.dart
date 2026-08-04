// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Gujarati (`gu`).
class LGu extends L {
  LGu([String locale = 'gu']) : super(locale);

  @override
  String get appName => 'Business Hub';

  @override
  String get navHome => 'હોમ';

  @override
  String get navStock => 'સ્ટોક';

  @override
  String get navClients => 'ગ્રાહકો';

  @override
  String get navHistory => 'હિસાબ';

  @override
  String get navPos => 'બિલિંગ';

  @override
  String get actionSave => 'સેવ કરો';

  @override
  String get actionCancel => 'રદ કરો';

  @override
  String get actionDelete => 'કાઢી નાખો';

  @override
  String get actionEdit => 'ફેરફાર';

  @override
  String get actionAdd => 'ઉમેરો';

  @override
  String get actionDone => 'થઈ ગયું';

  @override
  String get actionRetry => 'ફરી પ્રયાસ કરો';

  @override
  String get actionRefresh => 'રિફ્રેશ';

  @override
  String get actionClear => 'કાઢી નાખો';

  @override
  String get actionApply => 'લાગુ કરો';

  @override
  String get actionShare => 'મોકલો';

  @override
  String get actionPrint => 'પ્રિન્ટ';

  @override
  String get actionContinue => 'આગળ વધો';

  @override
  String get actionBack => 'પાછળ';

  @override
  String get actionSearch => 'શોધો';

  @override
  String get labelTotal => 'કુલ';

  @override
  String get labelSubtotal => 'પેટા-કુલ';

  @override
  String get labelPaid => 'ચૂકવેલ';

  @override
  String get labelDue => 'બાકી';

  @override
  String get labelBalanceDue => 'બાકી રકમ';

  @override
  String get labelDiscount => 'ડિસ્કાઉન્ટ';

  @override
  String get labelCustomer => 'ગ્રાહક';

  @override
  String get labelMobile => 'મોબાઇલ';

  @override
  String get labelQuantity => 'જથ્થો';

  @override
  String get labelPrice => 'કિંમત';

  @override
  String get labelStock => 'સ્ટોક';

  @override
  String get labelCategory => 'શ્રેણી';

  @override
  String get labelDate => 'તારીખ';

  @override
  String get labelPayment => 'ચુકવણી';

  @override
  String get labelNotes => 'નોંધ';

  @override
  String get labelName => 'નામ';

  @override
  String get labelOptional => 'વૈકલ્પિક';

  @override
  String get payCash => 'રોકડ';

  @override
  String get payUpi => 'UPI';

  @override
  String get payCard => 'કાર્ડ';

  @override
  String get payCredit => 'ઉધાર';

  @override
  String get paySplit => 'મિશ્ર';

  @override
  String get posTitle => 'બિલિંગ';

  @override
  String get posSearchHint => 'નામ, SKU કે બારકોડથી શોધો';

  @override
  String get posCartEmpty => 'કાર્ટ ખાલી છે';

  @override
  String get posCheckout => 'ચુકવણી';

  @override
  String get posCompleteSale => 'બિલ પૂરું કરો';

  @override
  String posSaveWithDue(String amount) {
    return '$amount બાકી સાથે સેવ કરો';
  }

  @override
  String get posAddDiscount => 'ડિસ્કાઉન્ટ ઉમેરો';

  @override
  String posDiscountOff(String amount) {
    return '$amount ડિસ્કાઉન્ટ';
  }

  @override
  String get posAddSplit => 'ચુકવણી વહેંચો';

  @override
  String get posScanToPay => 'ચુકવણી માટે સ્કેન કરો';

  @override
  String get posShowUpiQr => 'UPI QR બતાવો';

  @override
  String posSaleSaved(String amount) {
    return 'બિલ સેવ થયું: $amount';
  }

  @override
  String get posChange => 'પરત આપવાના';

  @override
  String get posCustomItem => 'અન્ય';

  @override
  String get posBuyerGstin => 'ગ્રાહક GSTIN (વૈકલ્પિક)';

  @override
  String get invTitle => 'સ્ટોક';

  @override
  String get invSearchHint => 'સ્ટોકમાં શોધો...';

  @override
  String get invAddItem => 'નવી વસ્તુ';

  @override
  String get invEditItem => 'વસ્તુ બદલો';

  @override
  String get invNewItem => 'નવી વસ્તુ ઉમેરો';

  @override
  String get invLowStock => 'ઓછો સ્ટોક';

  @override
  String get invRestock => 'સ્ટોક ભરો';

  @override
  String get invAddStock => 'સ્ટોક ઉમેરો';

  @override
  String get invAll => 'બધું';

  @override
  String get invOutOfStock => 'સ્ટોક ખતમ';

  @override
  String get invInStock => 'બરાબર';

  @override
  String invItemSaved(String name) {
    return '$name સેવ થયું.';
  }

  @override
  String get invTakePhoto => 'ફોટો પાડો';

  @override
  String get invChooseGallery => 'ગેલેરીમાંથી પસંદ કરો';

  @override
  String get invRemovePhoto => 'ફોટો કાઢી નાખો';

  @override
  String get custTitle => 'ગ્રાહકો';

  @override
  String get custAdd => 'ગ્રાહક ઉમેરો';

  @override
  String get custBalance => 'બાકી';

  @override
  String get custOutstanding => 'કુલ બાકી';

  @override
  String get custRemind => 'યાદ કરાવો';

  @override
  String get custNoCustomers => 'હજુ કોઈ ગ્રાહક નથી';

  @override
  String get custSearchHint => 'ગ્રાહક શોધો...';

  @override
  String get custKhata => 'ખાતું';

  @override
  String get histTitle => 'હિસાબ';

  @override
  String get histReceipts => 'બિલ';

  @override
  String get histGross => 'કુલ વેચાણ';

  @override
  String get histSearchHint => 'બિલ શોધો';

  @override
  String get histWalkIn => 'સામાન્ય ગ્રાહક';

  @override
  String get histRefund => 'પરત / રિફંડ';

  @override
  String get histRefunded => 'પરત કરેલ';

  @override
  String get histSynced => 'સેવ થયું';

  @override
  String get histQueued => 'બાકી છે';

  @override
  String get histTapDetail => 'વિગત જુઓ';

  @override
  String get histShareReceipt => 'બિલ મોકલો';

  @override
  String get settingsTitle => 'સેટિંગ્સ';

  @override
  String get settingsBusiness => 'દુકાનની માહિતી';

  @override
  String get settingsStaff => 'સ્ટાફ અને PIN';

  @override
  String get settingsTeam => 'ટીમ';

  @override
  String get settingsExpenses => 'ખર્ચ';

  @override
  String get settingsPurchases => 'સપ્લાયર અને ખરીદી';

  @override
  String get settingsBackup => 'બેકઅપ અને રિસ્ટોર';

  @override
  String get settingsImport => 'ડેટા ઇમ્પોર્ટ';

  @override
  String get settingsSecurity => 'સુરક્ષા';

  @override
  String get settingsPlanBilling => 'પ્લાન અને ચુકવણી';

  @override
  String get settingsLanguage => 'ભાષા';

  @override
  String get settingsLanguageSubtitle => 'એપની ભાષા';

  @override
  String get settingsSignOut => 'સાઇન આઉટ';

  @override
  String get langEnglish => 'English';

  @override
  String get langHindi => 'हिन्दी (Hindi)';

  @override
  String get langGujarati => 'ગુજરાતી (Gujarati)';

  @override
  String get langChanged => 'ભાષા બદલાઈ ગઈ.';

  @override
  String get errGeneric => 'કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.';

  @override
  String get errOffline => 'તમે ઓફલાઇન છો. ફેરફાર આ ફોનમાં સેવ છે.';

  @override
  String get errRequired => 'આ જરૂરી છે';

  @override
  String get errInvalidNumber => 'સાચો આંકડો દાખલ કરો';

  @override
  String get commonYes => 'હા';

  @override
  String get commonNo => 'ના';

  @override
  String get commonToday => 'આજે';

  @override
  String get commonYesterday => 'ગઈકાલે';

  @override
  String get commonThisWeek => 'આ અઠવાડિયે';

  @override
  String get commonThisMonth => 'આ મહિને';

  @override
  String get commonAllTime => 'અત્યાર સુધી';

  @override
  String get settingsShop => 'દુકાન';

  @override
  String get settingsManage => 'વ્યવસ્થા';

  @override
  String get settingsBusinessSub => 'નામ, બિલનો સંદેશ, ચલણ';

  @override
  String get settingsStaffSub => 'એકાઉન્ટ, ભૂમિકા અને PIN';

  @override
  String get settingsTeamSub => 'વર્કસ્પેસના સભ્યો (ક્લાઉડ)';

  @override
  String get settingsSwitchShop => 'દુકાન બદલો';

  @override
  String get settingsSwitchShopSub => 'ચાલુ વર્કસ્પેસ બદલો';

  @override
  String get settingsAttendance => 'હાજરી';

  @override
  String get settingsAttendanceSub => 'હાજરી અને શિફ્ટનો રેકોર્ડ';

  @override
  String get settingsExpensesSub => 'દુકાનનો ખર્ચ જુઓ';

  @override
  String get settingsPurchasesSub => 'માલની ખરીદી અને સપ્લાયર બાકી';

  @override
  String get settingsPlanBillingSub => 'તમારો પ્લાન, રિન્યુઅલ અને ચુકવણી';

  @override
  String get settingsComparePlans => 'પ્લાનની સરખામણી';

  @override
  String get settingsComparePlansSub => 'દરેક પ્લાનમાં શું મળે છે';

  @override
  String get settingsBackupSub => 'તમારો હિસાબ સુરક્ષિત રાખો';

  @override
  String get settingsImportSub => 'Zobaze માંથી ડેટા લાવો (.xlsx)';

  @override
  String get settingsChangePin => 'PIN બદલો';

  @override
  String get settingsChangePinSub => 'તમારો અનલોક PIN બદલો';

  @override
  String get settingsSecuritySub => 'એપ લોક અને MFA';

  @override
  String get settingsSync => 'સિંક';

  @override
  String get settingsAdminTools => 'એડમિન ટૂલ્સ';

  @override
  String get settingsAdminToolsSub => 'ડિવાઇસ અને સંચાલન';

  @override
  String get settingsRole => 'ભૂમિકા';

  @override
  String get settingsSignedIn => 'સાઇન ઇન';

  @override
  String get dashLowStock => 'ઓછો સ્ટોક';

  @override
  String get dashManage => 'જુઓ';

  @override
  String get dashWalkInSale => 'સામાન્ય વેચાણ';

  @override
  String dashLeft(String count) {
    return '$count બાકી';
  }

  @override
  String get dashRecentSales => 'તાજેતરની બિક્રી';

  @override
  String get dashTodaySales => 'આજનું વેચાણ';

  @override
  String get dashViewAll => 'બધું જુઓ';

  @override
  String get collectTitle => 'ઉધાર વસૂલાત';

  @override
  String get collectTotalOutstanding => 'કુલ બાકી';

  @override
  String get collectRemindAll => 'બધાને યાદ કરાવો';

  @override
  String get collectOnlyOverdue => 'ફક્ત બાકી';

  @override
  String get reorderTitle => 'ખરીદ યાદી';

  @override
  String get reorderSendOrder => 'ઓર્ડર મોકલો';

  @override
  String get reorderOutOfStock => 'સ્ટોક ખતમ';

  @override
  String get reorderSupplierPhone => 'સપ્લાયરનો મોબાઇલ નંબર';
}
