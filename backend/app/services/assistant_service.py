import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dashboard_service import DashboardService


MODULES = {
    "en": [
        {"keys": ["patient", "patients", "register patient"], "reply": "Manage patients in Patients — add records, edit details, view history.", "href": "/patients", "label": "Patients"},
        {"keys": ["doctor", "doctors", "commission"], "reply": "Doctors module tracks referring physicians and commission rates.", "href": "/doctors", "label": "Doctors"},
        {"keys": ["test", "tests", "catalog", "price"], "reply": "Tests catalog lets you define lab tests, prices, and turnaround times.", "href": "/tests", "label": "Tests"},
        {"keys": ["result", "results", "enter result", "release"], "reply": "Results module is for entering, verifying, and releasing lab results. You can also design result form templates.", "href": "/results", "label": "Results"},
        {"keys": ["invoice", "billing", "payment", "pay"], "reply": "Billing handles invoices, payments, discounts, and financial summaries.", "href": "/billing", "label": "Billing"},
        {"keys": ["expense", "expenses", "cost"], "reply": "Track laboratory expenses by vendor, category, and payment method.", "href": "/expenses", "label": "Expenses"},
        {"keys": ["inventory", "stock", "excel", "import"], "reply": "Inventory manages consumables. Download the Excel template and bulk-import items.", "href": "/inventory", "label": "Inventory"},
        {"keys": ["referral", "refer"], "reply": "Record doctor referrals linked to patients.", "href": "/referrals", "label": "Referrals"},
        {"keys": ["crm", "lead", "contact"], "reply": "CRM stores leads, partners, and customer contacts.", "href": "/crm", "label": "CRM"},
        {"keys": ["marketing", "campaign"], "reply": "Create and track marketing campaigns.", "href": "/marketing", "label": "Marketing"},
        {"keys": ["purchase", "purchasing", "po"], "reply": "Purchasing manages supplier purchase orders.", "href": "/purchasing", "label": "Purchasing"},
        {"keys": ["accounting", "profit", "revenue"], "reply": "Accounting shows revenue vs expenses and net profit.", "href": "/accounting", "label": "Accounting"},
        {"keys": ["setting", "branding", "logo", "lab name"], "reply": "Settings → Branding lets you upload your logo and set the lab name on the login page.", "href": "/settings", "label": "Settings"},
        {"keys": ["user", "staff", "password"], "reply": "Users module manages lab staff accounts and access.", "href": "/users", "label": "Users"},
        {"keys": ["branch", "branches"], "reply": "Branches module manages multi-location labs.", "href": "/branches", "label": "Branches"},
        {"keys": ["supplier", "suppliers"], "reply": "Suppliers stores vendor contact information.", "href": "/suppliers", "label": "Suppliers"},
        {"keys": ["dashboard", "overview", "stats"], "reply": "The dashboard shows live stats, financial insights, and recent activity.", "href": "/dashboard", "label": "Dashboard"},
        {"keys": ["login", "sign in", "username"], "reply": "Sign in with your laboratory code, username, and password on the login page.", "href": "/login", "label": "Login"},
    ],
    "ar": [
        {"keys": ["مريض", "مرضى", "تسجيل مريض"], "reply": "إدارة المرضى من قسم المرضى — إضافة سجلات وتعديل البيانات.", "href": "/patients", "label": "المرضى"},
        {"keys": ["طبيب", "أطباء", "عمولة"], "reply": "قسم الأطباء لتتبع الأطباء المحولين ونسب العمولة.", "href": "/doctors", "label": "الأطباء"},
        {"keys": ["تحليل", "تحاليل", "كتالوج", "سعر"], "reply": "كتالوج التحاليل لتحديد الأسعار ومدة التسليم.", "href": "/tests", "label": "التحاليل"},
        {"keys": ["نتيجة", "نتائج", "إدخال نتيجة"], "reply": "قسم النتائج لإدخال واعتماد وإصدار نتائج التحاليل وتصميم النماذج.", "href": "/results", "label": "النتائج"},
        {"keys": ["فاتورة", "فواتير", "دفع", "محاسبة"], "reply": "الفواتير تشمل إنشاء الفواتير وتسجيل المدفوعات والملخص المالي.", "href": "/billing", "label": "الفواتير"},
        {"keys": ["مصروف", "مصروفات"], "reply": "تتبع مصروفات المختبر حسب المورد والفئة.", "href": "/expenses", "label": "المصروفات"},
        {"keys": ["مخزون", "stock", "اكسل", "استيراد"], "reply": "المخزون لإدارة المستلزمات مع قالب Excel للاستيراد الجماعي.", "href": "/inventory", "label": "المخزون"},
        {"keys": ["إحالة", "احالة"], "reply": "تسجيل إحالات الأطباء للمرضى.", "href": "/referrals", "label": "الإحالات"},
        {"keys": ["عميل", "crm", "عملاء"], "reply": "إدارة علاقات العملاء والعملاء المحتملين.", "href": "/crm", "label": "إدارة العملاء"},
        {"keys": ["تسويق", "حملة"], "reply": "إنشاء ومتابعة حملات التسويق.", "href": "/marketing", "label": "التسويق"},
        {"keys": ["شراء", "مشتريات"], "reply": "أوامر الشراء من الموردين.", "href": "/purchasing", "label": "المشتريات"},
        {"keys": ["ربح", "إيراد", "محاسبة"], "reply": "المحاسبة تعرض الإيرادات مقابل المصروفات وصافي الربح.", "href": "/accounting", "label": "المحاسبة"},
        {"keys": ["إعداد", "شعار", "علامة", "اسم المختبر"], "reply": "الإعدادات → العلامة التجارية لرفع الشعار واسم المختبر.", "href": "/settings", "label": "الإعدادات"},
        {"keys": ["مستخدم", "موظف", "كلمة مرور"], "reply": "إدارة حسابات موظفي المختبر.", "href": "/users", "label": "المستخدمين"},
        {"keys": ["فرع", "فروع"], "reply": "إدارة فروع المختبر.", "href": "/branches", "label": "الفروع"},
        {"keys": ["مورد", "موردين"], "reply": "قاعدة بيانات الموردين.", "href": "/suppliers", "label": "الموردين"},
        {"keys": ["لوحة", "dashboard", "إحصاء"], "reply": "لوحة التحكم تعرض الإحصائيات والرؤى المالية والنشاط الأخير.", "href": "/dashboard", "label": "لوحة التحكم"},
        {"keys": ["دخول", "تسجيل دخول", "اسم مستخدم"], "reply": "تسجيل الدخول بكود المختبر واسم المستخدم وكلمة المرور.", "href": "/login", "label": "تسجيل الدخول"},
    ],
}


class AssistantService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def chat(self, tenant_id: UUID, message: str, locale: str = "ar") -> dict:
        text = message.strip().lower()
        lang = "ar" if locale == "ar" else "en"
        insights = await DashboardService(self.db).get_insights(tenant_id)

        live = self._live_answer(text, lang, insights)
        if live:
            return live

        for mod in MODULES[lang]:
            if any(k in text for k in mod["keys"]):
                return {
                    "reply": mod["reply"],
                    "links": [{"label": mod["label"], "href": mod["href"]}],
                }

        if lang == "ar":
            return {
                "reply": (
                    "أنا مساعد لاب ماستر. اسألني عن: المرضى، التحاليل، النتائج، الفواتير، المخزون، "
                    "المصروفات، الإعدادات، أو اطلب «ملخص المختبر» للحصول على أرقام حية."
                ),
                "links": [
                    {"label": "لوحة التحكم", "href": "/dashboard"},
                    {"label": "المرضى", "href": "/patients"},
                    {"label": "الإعدادات", "href": "/settings"},
                ],
            }
        return {
            "reply": (
                "I'm the LabMaster assistant. Ask about patients, tests, results, billing, inventory, "
                "expenses, settings — or say «lab summary» for live numbers."
            ),
            "links": [
                {"label": "Dashboard", "href": "/dashboard"},
                {"label": "Patients", "href": "/patients"},
                {"label": "Settings", "href": "/settings"},
            ],
        }

    def _live_answer(self, text: str, lang: str, insights: dict) -> dict | None:
        stats = insights["stats"]
        fin = insights["financial"]
        exp = insights["expenses"]
        orders = insights["orders"]

        summary_keys = ["summary", "ملخص", "overview", "احصاء", "إحصاء", "numbers", "أرقام", "how many", "كم"]
        if any(k in text for k in summary_keys):
            if lang == "ar":
                return {
                    "reply": (
                        f"📊 ملخص المختبر:\n"
                        f"• المرضى: {stats['patients']}\n"
                        f"• الأطباء: {stats['doctors']}\n"
                        f"• التحاليل: {stats['tests']}\n"
                        f"• أصناف المخزون: {stats['inventory_items']}\n"
                        f"• منخفض المخزون: {stats['low_stock_items']}\n"
                        f"• إجمالي الفواتير: {fin['total_invoiced']:,.0f} جنيه\n"
                        f"• المحصّل: {fin['total_collected']:,.0f} جنيه\n"
                        f"• المستحق: {fin['outstanding']:,.0f} جنيه\n"
                        f"• المصروفات: {exp['total_expenses']:,.0f} جنيه\n"
                        f"• صافي الربح: {insights['net_profit']:,.0f} جنيه\n"
                        f"• طلبات معلقة: {orders['pending_orders']}"
                    ),
                    "links": [{"label": "لوحة التحكم", "href": "/dashboard"}],
                }
            return {
                "reply": (
                    f"📊 Lab summary:\n"
                    f"• Patients: {stats['patients']}\n"
                    f"• Doctors: {stats['doctors']}\n"
                    f"• Tests: {stats['tests']}\n"
                    f"• Inventory items: {stats['inventory_items']}\n"
                    f"• Low stock: {stats['low_stock_items']}\n"
                    f"• Total invoiced: EGP {fin['total_invoiced']:,.0f}\n"
                    f"• Collected: EGP {fin['total_collected']:,.0f}\n"
                    f"• Outstanding: EGP {fin['outstanding']:,.0f}\n"
                    f"• Expenses: EGP {exp['total_expenses']:,.0f}\n"
                    f"• Net profit: EGP {insights['net_profit']:,.0f}\n"
                    f"• Pending orders: {orders['pending_orders']}"
                ),
                "links": [{"label": "Dashboard", "href": "/dashboard"}],
            }

        money_keys = ["revenue", "money", "collected", "outstanding", "إيراد", "فلوس", "محصّل", "مستحق"]
        if any(k in text for k in money_keys):
            if lang == "ar":
                return {
                    "reply": (
                        f"💰 الوضع المالي: تم فوترة {fin['total_invoiced']:,.0f} جنيه، "
                        f"تم تحصيل {fin['total_collected']:,.0f} جنيه، "
                        f"المتبقي {fin['outstanding']:,.0f} جنيه ({fin['invoice_count']} فاتورة)."
                    ),
                    "links": [{"label": "الفواتير", "href": "/billing"}],
                }
            return {
                "reply": (
                    f"💰 Financials: EGP {fin['total_invoiced']:,.0f} invoiced, "
                    f"EGP {fin['total_collected']:,.0f} collected, "
                    f"EGP {fin['outstanding']:,.0f} outstanding ({fin['invoice_count']} invoices)."
                ),
                "links": [{"label": "Billing", "href": "/billing"}],
            }

        stock_keys = ["low stock", "منخفض", "نفاد", "reorder"]
        if any(k in text for k in stock_keys):
            low = insights["low_stock"]
            if not low:
                msg = "لا توجد أصناف منخفضة المخزون حالياً." if lang == "ar" else "No low-stock items right now."
            else:
                lines = "\n".join(f"• {i['name']} ({i['total_quantity']}/{i['reorder_level']})" for i in low[:5])
                msg = f"⚠️ أصناف منخفضة:\n{lines}" if lang == "ar" else f"⚠️ Low stock:\n{lines}"
            return {"reply": msg, "links": [{"label": "المخزون" if lang == "ar" else "Inventory", "href": "/inventory"}]}

        if re.search(r"help|مساعدة|ماذا|what can", text):
            if lang == "ar":
                return {
                    "reply": "يمكنني مساعدتك في:\n• التنقل بين الوحدات\n• ملخص المختبر والأرقام الحية\n• شرح كيفية استخدام الفواتير والمخزون والنتائج",
                    "links": [
                        {"label": "المرضى", "href": "/patients"},
                        {"label": "النتائج", "href": "/results"},
                        {"label": "الفواتير", "href": "/billing"},
                    ],
                }
            return {
                "reply": "I can help with:\n• Navigating modules\n• Live lab summary & numbers\n• How to use billing, inventory, results",
                "links": [
                    {"label": "Patients", "href": "/patients"},
                    {"label": "Results", "href": "/results"},
                    {"label": "Billing", "href": "/billing"},
                ],
            }

        return None
