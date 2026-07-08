# Capacitor rules
-keep class com.getcapacitor.** { *; }
-keep  class **.R$* {
    <fields>;
}
-keepclasseswithmembernames class * {
    native <methods>;
}

# SQLite rules
-keep class com.getcapacitor.community.database.sqlite.** { *; }
-keep class net.sqlcipher.** { *; }

# Firebase / GMS rules
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.ktx.**
-dontwarn com.google.firebase.installations.ktx.**
-dontwarn com.google.firebase.appcheck.ktx.**
-dontwarn com.google.firebase.components.**

# Preserve line numbers for better crash logs
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
