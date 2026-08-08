// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class LHi extends L {
  LHi([String locale = 'hi']) : super(locale);

  @override
  String get appName => 'Business Hub';

  @override
  String get navHome => 'होम';

  @override
  String get navStock => 'स्टॉक';

  @override
  String get navClients => 'ग्राहक';

  @override
  String get navHistory => 'हिसाब';

  @override
  String get navPos => 'बिलिंग';

  @override
  String get actionSave => 'सेव करें';

  @override
  String get actionCancel => 'रद्द करें';

  @override
  String get actionDelete => 'हटाएँ';

  @override
  String get actionEdit => 'बदलें';

  @override
  String get actionAdd => 'जोड़ें';

  @override
  String get actionDone => 'हो गया';

  @override
  String get actionRetry => 'फिर कोशिश करें';

  @override
  String get actionRefresh => 'रिफ्रेश';

  @override
  String get actionClear => 'हटाएँ';

  @override
  String get actionApply => 'लागू करें';

  @override
  String get actionShare => 'भेजें';

  @override
  String get actionPrint => 'प्रिंट';

  @override
  String get actionContinue => 'आगे बढ़ें';

  @override
  String get actionBack => 'वापस';

  @override
  String get actionSearch => 'खोजें';

  @override
  String get labelTotal => 'कुल';

  @override
  String get labelSubtotal => 'उप-कुल';

  @override
  String get labelPaid => 'चुकाया';

  @override
  String get labelDue => 'बाकी';

  @override
  String get labelBalanceDue => 'बाकी रकम';

  @override
  String get labelDiscount => 'छूट';

  @override
  String get labelCustomer => 'ग्राहक';

  @override
  String get labelMobile => 'मोबाइल';

  @override
  String get labelQuantity => 'मात्रा';

  @override
  String get labelPrice => 'कीमत';

  @override
  String get labelStock => 'स्टॉक';

  @override
  String get labelCategory => 'श्रेणी';

  @override
  String get labelDate => 'तारीख';

  @override
  String get labelPayment => 'भुगतान';

  @override
  String get labelNotes => 'टिप्पणी';

  @override
  String get labelName => 'नाम';

  @override
  String get labelOptional => 'वैकल्पिक';

  @override
  String get payCash => 'नकद';

  @override
  String get payUpi => 'UPI';

  @override
  String get payCard => 'कार्ड';

  @override
  String get payCredit => 'उधार';

  @override
  String get paySplit => 'मिश्रित';

  @override
  String get posTitle => 'बिलिंग';

  @override
  String get posSearchHint => 'नाम, SKU या बारकोड से खोजें';

  @override
  String get posCartEmpty => 'कार्ट खाली है';

  @override
  String get posCheckout => 'भुगतान';

  @override
  String get posCompleteSale => 'बिल पूरा करें';

  @override
  String posSaveWithDue(String amount) {
    return '$amount बाकी के साथ सेव करें';
  }

  @override
  String get posAddDiscount => 'छूट जोड़ें';

  @override
  String posDiscountOff(String amount) {
    return '$amount की छूट';
  }

  @override
  String get posAddSplit => 'भुगतान बाँटें';

  @override
  String get posScanToPay => 'भुगतान के लिए स्कैन करें';

  @override
  String get posShowUpiQr => 'UPI QR दिखाएँ';

  @override
  String posSaleSaved(String amount) {
    return 'बिल सेव हुआ: $amount';
  }

  @override
  String get posChange => 'बाकी लौटाना';

  @override
  String get posCustomItem => 'अन्य';

  @override
  String get posBuyerGstin => 'ग्राहक GSTIN (वैकल्पिक)';

  @override
  String get invTitle => 'स्टॉक';

  @override
  String get invSearchHint => 'स्टॉक में खोजें...';

  @override
  String get invAddItem => 'नई वस्तु';

  @override
  String get invEditItem => 'वस्तु बदलें';

  @override
  String get invNewItem => 'नई वस्तु जोड़ें';

  @override
  String get invLowStock => 'कम स्टॉक';

  @override
  String get invRestock => 'स्टॉक भरें';

  @override
  String get invAddStock => 'स्टॉक जोड़ें';

  @override
  String get invAll => 'सभी';

  @override
  String get invOutOfStock => 'स्टॉक खत्म';

  @override
  String get invInStock => 'ठीक';

  @override
  String invItemSaved(String name) {
    return '$name सेव हुआ।';
  }

  @override
  String get invTakePhoto => 'फोटो लें';

  @override
  String get invChooseGallery => 'गैलरी से चुनें';

  @override
  String get invRemovePhoto => 'फोटो हटाएँ';

  @override
  String get custTitle => 'ग्राहक';

  @override
  String get custAdd => 'ग्राहक जोड़ें';

  @override
  String get custBalance => 'बकाया';

  @override
  String get custOutstanding => 'कुल बकाया';

  @override
  String get custRemind => 'याद दिलाएँ';

  @override
  String get custNoCustomers => 'अभी कोई ग्राहक नहीं';

  @override
  String get custSearchHint => 'ग्राहक खोजें...';

  @override
  String get custKhata => 'खाता';

  @override
  String get histTitle => 'हिसाब';

  @override
  String get histReceipts => 'बिल';

  @override
  String get histGross => 'कुल बिक्री';

  @override
  String get histSearchHint => 'बिल खोजें';

  @override
  String get histWalkIn => 'सामान्य ग्राहक';

  @override
  String get histRefund => 'वापसी / रिफंड';

  @override
  String get histRefunded => 'वापस किया';

  @override
  String get histSynced => 'सेव हुआ';

  @override
  String get histQueued => 'बाकी है';

  @override
  String get histTapDetail => 'विवरण देखें';

  @override
  String get histShareReceipt => 'बिल भेजें';

  @override
  String get settingsTitle => 'सेटिंग्स';

  @override
  String get settingsBusiness => 'दुकान की जानकारी';

  @override
  String get settingsStaff => 'स्टाफ और PIN';

  @override
  String get settingsTeam => 'टीम';

  @override
  String get settingsExpenses => 'खर्च';

  @override
  String get settingsPurchases => 'सप्लायर और खरीद';

  @override
  String get settingsBackup => 'बैकअप और रिस्टोर';

  @override
  String get settingsImport => 'डेटा इम्पोर्ट';

  @override
  String get settingsSecurity => 'सुरक्षा';

  @override
  String get settingsPlanBilling => 'प्लान और भुगतान';

  @override
  String get settingsLanguage => 'भाषा';

  @override
  String get settingsLanguageSubtitle => 'ऐप की भाषा';

  @override
  String get settingsSignOut => 'साइन आउट';

  @override
  String get langEnglish => 'English';

  @override
  String get langHindi => 'हिन्दी (Hindi)';

  @override
  String get langGujarati => 'ગુજરાતી (Gujarati)';

  @override
  String get langChanged => 'भाषा बदल गई।';

  @override
  String get errGeneric => 'कुछ गड़बड़ हुई। फिर कोशिश करें।';

  @override
  String get errOffline => 'आप ऑफलाइन हैं। बदलाव इसी फोन में सेव हैं।';

  @override
  String get errRequired => 'यह जरूरी है';

  @override
  String get errInvalidNumber => 'सही संख्या डालें';

  @override
  String get commonYes => 'हाँ';

  @override
  String get commonNo => 'नहीं';

  @override
  String get commonToday => 'आज';

  @override
  String get commonYesterday => 'कल';

  @override
  String get commonThisWeek => 'इस हफ्ते';

  @override
  String get commonThisMonth => 'इस महीने';

  @override
  String get commonAllTime => 'अब तक';

  @override
  String get settingsShop => 'दुकान';

  @override
  String get settingsManage => 'प्रबंधन';

  @override
  String get settingsBusinessSub => 'नाम, बिल का संदेश, मुद्रा';

  @override
  String get settingsStaffSub => 'खाते, भूमिकाएँ और PIN';

  @override
  String get settingsTeamSub => 'वर्कस्पेस के सदस्य (क्लाउड)';

  @override
  String get settingsSwitchShop => 'दुकान बदलें';

  @override
  String get settingsSwitchShopSub => 'चालू वर्कस्पेस बदलें';

  @override
  String get settingsAttendance => 'हाजिरी';

  @override
  String get settingsAttendanceSub => 'हाजिरी और शिफ्ट का रिकॉर्ड';

  @override
  String get settingsExpensesSub => 'दुकान का खर्च देखें';

  @override
  String get settingsPurchasesSub => 'माल की खरीद और सप्लायर बकाया';

  @override
  String get settingsPlanBillingSub => 'आपका प्लान, नवीनीकरण और भुगतान';

  @override
  String get settingsComparePlans => 'प्लान की तुलना';

  @override
  String get settingsComparePlansSub => 'हर प्लान में क्या मिलता है';

  @override
  String get settingsBackupSub => 'अपना हिसाब सुरक्षित रखें';

  @override
  String get settingsImportSub => 'Zobaze से डेटा लाएँ (.xlsx)';

  @override
  String get settingsChangePin => 'PIN बदलें';

  @override
  String get settingsChangePinSub => 'अपना अनलॉक PIN बदलें';

  @override
  String get settingsSecuritySub => 'ऐप लॉक और MFA';

  @override
  String get settingsSync => 'सिंक';

  @override
  String get settingsAdminTools => 'एडमिन टूल्स';

  @override
  String get settingsAdminToolsSub => 'डिवाइस और संचालन';

  @override
  String get settingsRole => 'भूमिका';

  @override
  String get settingsSignedIn => 'साइन इन';

  @override
  String get dashLowStock => 'कम स्टॉक';

  @override
  String get dashManage => 'देखें';

  @override
  String get dashWalkInSale => 'सामान्य बिक्री';

  @override
  String dashLeft(String count) {
    return '$count बचे';
  }

  @override
  String get dashRecentSales => 'हाल की बिक्री';

  @override
  String get dashTodaySales => 'आज की बिक्री';

  @override
  String get dashViewAll => 'सब देखें';

  @override
  String get collectTitle => 'उधार वसूली';

  @override
  String get collectTotalOutstanding => 'कुल बकाया';

  @override
  String get collectRemindAll => 'सबको याद दिलाएँ';

  @override
  String get collectOnlyOverdue => 'सिर्फ बकाया';

  @override
  String get reorderTitle => 'खरीद सूची';

  @override
  String get reorderSendOrder => 'ऑर्डर भेजें';

  @override
  String get reorderOutOfStock => 'स्टॉक खत्म';

  @override
  String get reorderSupplierPhone => 'सप्लायर का मोबाइल नंबर';

  @override
  String get expAdd => 'खर्च जोड़ें';

  @override
  String get expDetails => 'खर्च का विवरण';

  @override
  String get expTotal => 'कुल खर्च';

  @override
  String get purSuppliers => 'सप्लायर और खरीद';

  @override
  String get purOutstanding => 'सप्लायर को बकाया';

  @override
  String get purRecent => 'हाल की खरीद';

  @override
  String get purAdd => 'खरीद जोड़ें';

  @override
  String get backupTitle => 'बैकअप और रिस्टोर';

  @override
  String get backupSaved => 'सेव किए बैकअप';

  @override
  String get teamTitle => 'टीम';

  @override
  String get teamInvite => 'सदस्य जोड़ें';

  @override
  String get billingTitle => 'प्लान और भुगतान';

  @override
  String get billingChoosePlan => 'प्लान चुनें';

  @override
  String get billingPaid => 'मैंने भुगतान किया - रिफ्रेश';

  @override
  String get healthTitle => 'डेटा जाँच';

  @override
  String get healthNothing => 'कुछ ठीक करने को नहीं';

  @override
  String get healthDuplicates => 'दोहरी वस्तुएँ';

  @override
  String get healthMerge => 'मिलाएँ';

  @override
  String get healthMergeAll => 'सब मिलाएँ';

  @override
  String get deadStockTitle => 'बिना बिका स्टॉक';

  @override
  String get deadStockMoney => 'फँसा हुआ पैसा';

  @override
  String get deadNeverSold => 'कभी नहीं बिका';

  @override
  String get reportsTitle => 'रिपोर्ट';

  @override
  String get reportsProfit => 'मुनाफा';

  @override
  String get reportsBestSellers => 'सबसे ज्यादा बिकने वाले';

  @override
  String get reportsCashFlow => 'नकदी प्रवाह';

  @override
  String get reportsMoneyIn => 'आया';

  @override
  String get reportsMoneyOut => 'गया';

  @override
  String get reportsNet => 'बचत';

  @override
  String get staffPerformance => 'स्टाफ का काम';

  @override
  String get staffSoldBy => 'बेचा';

  @override
  String get welcomeTitle => 'Business Hub में स्वागत है';

  @override
  String get welcomeSetup => 'अपनी दुकान सेट करें';

  @override
  String get welcomeSkip => 'अभी छोड़ें';

  @override
  String get welcomeFinish => 'सेटअप पूरा करें';

  @override
  String get posFavourites => 'पसंदीदा';
}
