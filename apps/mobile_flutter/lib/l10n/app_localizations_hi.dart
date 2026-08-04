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
}
