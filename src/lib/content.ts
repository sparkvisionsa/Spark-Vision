import {
  CodeXml,
  Smartphone,
  BrainCircuit,
  CloudCog,
  Briefcase,
  Award,
  Scaling,
  Zap,
  Users2,
  ShieldCheck,
  Linkedin,
  Twitter,
  Facebook,
  MessageCircle,
  TicketCheck,
} from "lucide-react";

interface ValueTechContent {
  iconLabel: string;
  badge: string;
  headline: string;
  subheading: string;
  description: string;
  focusedContent: string;
  security: string;
  uploadSpeed: string;
  efficiency: string;
  cta: string;
  mission: string;
  requestDemo: string;
  whatsappNumber: string;
  installApp: string;
  stats: { value: string; label: string }[];
  benefitsAndFeatures: string;
  featuresTitle: string;
  trustedWorkflow: string;
  focusedContentDescription: string;
  focusedContentBadge1: string;
  focusedContentBadge2: string;
  focusedContentBadge3: string;
  desktopApplication: string;
  desktopTitle: string;
  desktopDescription: string;
  benefits: string[];
  howItWorks: string;
  howItWorksTitle: string;
  howItWorksDescription: string;
  workflowSteps: { title: string; description: string }[];
  featureCards: { title: string; description: string }[];
  installTheApp: string;
  installTitle: string;
  installDescription: string;
  installSteps: { title: string; description: string }[];
  callToAction: string;
  ctaTitle: string;
  ctaDescription: string;
  bookOnboarding: string;
  viewWorkflow: string;
  socialProof: string;
  socialProofTitle: string;
  socialProofDescription: string;
  testimonials: { quote: string; name: string; role: string }[];
  leadCaptureForm: string;
  leadTitle: string;
  leadDescription: string;
  respondNote: string;
  onboardingSpecialist: string;
  customTemplates: string;
  training: string;
  form: {
    name: string;
    company: string;
    email: string;
    phone: string;
    message: string;
    placeholder: {
      name: string;
      company: string;
      email: string;
      phone: string;
      message: string;
    };
    button: string;
  };
  trustedByTeams: string;
  builtForBusyTeams: string;
  trustIndicators: string;
  trustTitle: string;
  securityFirst: string;
  trustItems: { title: string; description: string }[];
  heroImage: string;
  desktopPreview: string;
  watchWorkflow: string;
  desktopApp: string;
  desktopAppDescription: string;
  installExperience: string;
  installExperienceDescription: string;
  liveUploads: string;
  liveUploadsDescription: string;
  secureAccess: string;
  secureAccessDescription: string;
}

export const content = {
  valueTech: {
    en: {
      iconLabel: "Value Tech Icon",
      badge: "Value Tech Application",
      headline: "Value Tech",
      subheading: "Simple",
      description: "Quick, secure uploads to Taqeem.",
      focusedContent: "Your data security is our priority, upload speed ensures your comfort, high efficiency saves your time... Upload your report now and excel in your profession!",
      security: "Your data security is our priority",
      uploadSpeed: "Upload speed ensures your comfort",
      efficiency: "High efficiency saves your time",
      cta: "Upload your report now and excel in your profession!",
      mission: "Reliable uploads to Taqeem.",
      requestDemo: "Contact Us",
      whatsappNumber: "",
      installApp: "Install the App",
      stats: [
        { value: "98%", label: "Upload success rate" },
        { value: "4x", label: "Faster submission cycle" },
        { value: "24/7", label: "Desktop availability" },
      ],
      benefitsAndFeatures: "Benefits",
      featuresTitle: "Fast and secure",
      trustedWorkflow: "Trusted workflow.",
      focusedContentDescription: "Upload reports with clear steps.",
      focusedContentBadge1: "Uploading Reports",
      focusedContentBadge2: "Evaluation Sources",
      focusedContentBadge3: "Trusted Workflow",
      desktopApplication: "Desktop app",
      desktopTitle: "Desktop Application center",
      desktopDescription: "Guided workflow for uploads.",
      benefits: [
        "Reduce manual data entry and shorten appraisal cycles.",
        "Keep compliance aligned with built-in checks for every report.",
        "Support multiple teams with shared templates and approvals.",
        "Stay organized with a single dashboard for uploads and status.",
      ],
      howItWorks: "How it works",
      howItWorksTitle: "Clear steps",
      howItWorksDescription: "Follow the guided flow.",
      workflowSteps: [
        {
          title: "Click on Apps",
          description: "Open the Value Tech desktop dashboard and click Apps to enter the services hub.",
        },
        {
          title: "Select a service",
          description: "Choose Uploading Reports or Evaluation Sources to start the right workflow.",
        },
        {
          title: "Pick category (equipments or real estate)",
          description: "Inside Uploading Reports, select equipment or real estate based on the report type.",
        },
        {
          title: "Choose upload method",
          description: "Submit reports quickly, upload assets, multi excel upload, or upload manual reports. Each page includes clear instructions.",
        },
        {
          title: "Login to Taqeem",
          description: "After the Excel upload, sign in to Taqeem to submit the final reports.",
        },
        {
          title: "Delete reports by ID",
          description: "Move to the delete page and enter a report ID to remove submissions safely.",
        },
        {
          title: "Track all uploaded reports",
          description: "Review every report that has been sent to the Taqeem system from one view.",
        },
      ],
      featureCards: [
        {
          title: "Fast uploads",
          description: "Accelerate report delivery with optimized batch pipelines.",
        },
        {
          title: "Secure by design",
          description: "Encrypted transfers with role-based access for every team.",
        },
        {
          title: "Excel smart import",
          description: "Multi excel upload with validation checks and previews.",
        },
        {
          title: "Asset media vault",
          description: "Attach photos and documents to each equipment or property.",
        },
        {
          title: "Taqeem ready",
          description: "One login to submit, monitor, and sync every report.",
        },
        {
          title: "Audit friendly",
          description: "Track changes and keep a clean history of approvals.",
        },
      ],
      installTheApp: "Install",
      installTitle: "Setup in minutes",
      installDescription: "Fast install for consistent experience.",
      installSteps: [
        {
          title: "Download the installer",
          description: "Get the latest Value Tech build for Windows devices.",
        },
        {
          title: "Run guided setup",
          description: "Install in minutes with secure permissions and device checks.",
        },
        {
          title: "Connect to Taqeem",
          description: "Sign in once to link your workspace and sync reports.",
        },
        {
          title: "Start your first upload",
          description: "Choose Uploading Reports and follow the on-screen steps.",
        },
      ],
      callToAction: "CTA",
      ctaTitle: "Get installer today",
      ctaDescription: "Guided onboarding and support.",
      bookOnboarding: "Book onboarding",
      viewWorkflow: "View the workflow",
      socialProof: "Proof",
      socialProofTitle: "Trusted by teams",
      socialProofDescription: "Consistent and auditable uploads.",
      testimonials: [
        {
          quote: "Value Tech made our uploads predictable. Reports are submitted to Taqeem on the same day.",
          name: "Sara Almutairi",
          role: "Operations Lead",
        },
        {
          quote: "The multi excel upload alone saved us hours each week, and the audit trail is clear.",
          name: "Hassan Alqahtani",
          role: "Appraisal Manager",
        },
      ],
      leadCaptureForm: "Form",
      leadTitle: "Your needs",
      leadDescription: "Share workflow for plan.",
      respondNote: "Respond in one day.",
      onboardingSpecialist: "Specialist",
      customTemplates: "Templates",
      training: "Training",
      form: {
        name: "Name",
        company: "Company",
        email: "Email",
        phone: "Phone",
        message: "Workflow details",
        placeholder: {
          name: "Your name",
          company: "Organization name",
          email: "you@email.com",
          phone: "+966 5X XXX XXXX",
          message: "Tell us how you upload reports today.",
        },
        button: "Send request",
      },
      trustedByTeams: "Trusted by teams",
      builtForBusyTeams: "For busy teams.",
      trustIndicators: "Indicators",
      trustTitle: "Compliance and control",
      securityFirst: "Secure workflows.",
      trustItems: [
        {
          title: "Encrypted sessions",
          description: "Secure authentication with session protection.",
        },
        {
          title: "Verified workflows",
          description: "Step-by-step instructions inside every page.",
        },
        {
          title: "Reliable uptime",
          description: "Built for always-on desktop operations.",
        },
      ],
      heroImage: "Hero",
      desktopPreview: "Preview",
      watchWorkflow: "Watch",
      desktopApp: "App",
      desktopAppDescription: "Fast caching and uploads.",
      installExperience: "Install",
      installExperienceDescription: "Simple setup.",
      liveUploads: "Uploads",
      liveUploadsDescription: "Push reports with tracking.",
      secureAccess: "Access",
      secureAccessDescription: "Role-based permissions.",
    },
    ar: {
      iconLabel: "أيقونة فاليو تك",
      badge: "تطبيق فاليو تك",
      headline: "فاليو تك",
      subheading: "بسيط",
      description: "تحميل سريع وآمن إلى تقييم.",
      focusedContent: "أمان بياناتك أولويتنا، سرعة الرفع تضمن راحتك، كفاءة عالية توفر وقتك... ارفع تقريرك الآن وتميز في مهنتك!",
      security: "أمان بياناتك أولويتنا",
      uploadSpeed: "سرعة الرفع تضمن راحتك",
      efficiency: "كفاءة عالية توفر وقتك",
      cta: "ارفع تقريرك الآن وتميز في مهنتك!",
      mission: "تحميلات موثوقة إلى تقييم.",
      requestDemo: "تواصل معنا",
      whatsappNumber: "",
      installApp: "تثبيت التطبيق",
      stats: [
        { value: "98%", label: "معدل نجاح التحميل" },
        { value: "4x", label: "دورة تقديم أسرع" },
        { value: "24/7", label: "توافر سطح المكتب" },
      ],
      desktopApplication: "تطبيق سطح مكتب",
      desktopTitle: "مركز تطبيق سطح مكتب",
      desktopDescription: "سير عمل موجه للتحميلات.",
      focusedContentDescription: "تحميل التقارير بخطوات واضحة.",
      focusedContentBadge1: "تحميل التقارير",
      focusedContentBadge2: "مصادر التقييم",
      focusedContentBadge3: "سير عمل موثوق",
      uploadingReports: "تحميل التقارير",
      evaluationSources: "مصادر التقييم",
      desktopWorkflow: "سير عمل سطح المكتب",
      trustedWorkflow: "سير عمل موثوق.",
      callToAction: "دعوة",
      benefits: [
        "تقليل إدخال البيانات اليدوية وتقصير دورات التقييم.",
        "الحفاظ على الامتثال مع الفحوصات المدمجة لكل تقرير.",
        "دعم فرق متعددة مع قوالب وموافقات مشتركة.",
        "البقاء منظماً مع لوحة تحكم واحدة للتحميلات والحالة.",
      ],
      howItWorks: "كيف يعمل",
      howItWorksTitle: "خطوات واضحة",
      howItWorksDescription: "اتبع التدفق الموجه.",
      workflowSteps: [
        {
          title: "انقر على التطبيقات",
          description: "افتح لوحة تحكم سطح المكتب فاليو تك وانقر على التطبيقات للدخول إلى مركز الخدمات.",
        },
        {
          title: "اختر خدمة",
          description: "اختر تحميل التقارير أو مصادر التقييم لبدء سير العمل الصحيح.",
        },
        {
          title: "اختر فئة (المعدات أو العقارات)",
          description: "داخل تحميل التقارير، اختر المعدات أو العقارات بناءً على نوع التقرير.",
        },
        {
          title: "اختر طريقة التحميل",
          description: "قدم التقارير بسرعة، حمل الأصول، تحميل إكسيل متعدد، أو تقارير يدوية. كل صفحة تشمل تعليمات واضحة.",
        },
        {
          title: "تسجيل الدخول إلى تقييم",
          description: "بعد تحميل الإكسيل، قم بتسجيل الدخول إلى تقييم لتقديم التقارير النهائية.",
        },
        {
          title: "يمكنك حذف التقارير بالمعرف ",
          description: "انتقل إلى صفحة الحذف وأدخل معرف التقرير لإزالة التقديمات بأمان.",
        },
        {
          title: "تتبع جميع التقارير التي تم تحميلها",
          description: "راجع كل تقرير تم إرساله إلى نظام تقييم من عرض واحد.",
        },
      ],
      benefitsAndFeatures: "الفوائد",
      featuresTitle: "سريع وآمن",
      featureCards: [
        {
          title: "تحميلات سريعة",
          description: "تسريع تسليم التقارير مع خطوط أنابيب دفعية محسنة.",
        },
        {
          title: "آمن حسب التصميم",
          description: "نقل مشفر مع وصول مبني على الأدوار لكل فريق.",
        },
        {
          title: "استيراد إكسيل ذكي",
          description: "تحميل إكسيل متعدد مع فحوصات التحقق والمعاينات.",
        },
        {
          title: "خزنة وسائط الأصول",
          description: "إرفاق الصور والوثائق بكل معدات أو عقار.",
        },
        {
          title: "جاهز لتقييم",
          description: "تسجيل دخول واحد للتقديم والمراقبة ومزامنة كل تقرير.",
        },
        {
          title: "ودي للتدقيق",
          description: "تتبع التغييرات والحفاظ على تاريخ نظيف للموافقات.",
        },
      ],
      installTheApp: "تثبيت",
      installTitle: "إعداد في دقائق",
      installDescription: "تثبيت سريع لتجربة متسقة.",
      installSteps: [
        {
          title: "تحميل المثبت",
          description: "احصل على أحدث إصدار فاليو تك لأجهزة ويندوز.",
        },
        {
          title: "تشغيل الإعداد الموجه",
          description: "التثبيت في دقائق مع أذونات آمنة وفحوصات الأجهزة.",
        },
        {
          title: "الاتصال بتقييم",
          description: "سجل الدخول مرة واحدة لربط مساحة العمل الخاصة بك ومزامنة التقارير.",
        },
        {
          title: "ابدأ أول تحميل لك",
          description: "اختر تحميل التقارير واتبع الخطوات على الشاشة.",
        },
      ],
      ctaTitle: "احصل على مثبت اليوم",
      ctaDescription: "توجيه موجه ودعم.",
      bookOnboarding: "حجز التوجيه",
      viewWorkflow: "عرض سير العمل",
      socialProof: "إثبات",
      socialProofTitle: "موثوق من الفرق",
      socialProofDescription: "تحميلات متسقة وقابلة للتدقيق.",
      testimonials: [
        {
          quote: "جعل فاليو تك تحميلاتنا متوقعة. يتم تقديم التقارير إلى تقييم في نفس اليوم.",
          name: "سارة المطيري",
          role: "قائد العمليات",
        },
        {
          quote: "تحميل الإكسيل المتعدد وحده وفر لنا ساعات كل أسبوع، ومسار التدقيق واضح.",
          name: "حسن القحطاني",
          role: "مدير التقييم",
        },
      ],
      leadCaptureForm: "نموذج",
      leadTitle: "احتياجاتك",
      leadDescription: "شارك سير العمل للخطة.",
      respondNote: "نرد في يوم واحد.",
      onboardingSpecialist: "أخصائي",
      customTemplates: "قوالب",
      training: "تدريب",
      form: {
        name: "الاسم",
        company: "الشركة",
        email: "البريد الإلكتروني",
        phone: "الهاتف",
        message: "تفاصيل سير العمل",
        placeholder: {
          name: "اسمك",
          company: "اسم المنظمة",
          email: "you@email.com",
          phone: "+966 5X XXX XXXX",
          message: "أخبرنا كيف تقوم بتحميل التقارير اليوم.",
        },
        button: "إرسال الطلب",
      },
      trustedByTeams: "موثوق من الفرق",
      builtForBusyTeams: "للفرق المزدحمة.",
      trustIndicators: "مؤشرات",
      trustTitle: "امتثال وسيطرة",
      securityFirst: "سير عمل آمن.",
      trustItems: [
        {
          title: "جلسات مشفرة",
          description: "مصادقة آمنة مع حماية الجلسة.",
        },
        {
          title: "سير عمل موثق",
          description: "تعليمات خطوة بخطوة داخل كل صفحة.",
        },
        {
          title: "وقت تشغيل موثوق",
          description: "مصمم لعمليات سطح المكتب دائمة التشغيل.",
        },
      ],
      heroImage: "بطل",
      desktopPreview: "معاينة",
      watchWorkflow: "مشاهدة",
      desktopApp: "تطبيق",
      desktopAppDescription: "تخزين سريع وتحميلات مستقرة.",
      installExperience: "تثبيت",
      installExperienceDescription: "إعداد بسيط.",
      liveUploads: "تحميلات",
      liveUploadsDescription: "دفع التقارير مع التتبع.",
      secureAccess: "وصول",
      secureAccessDescription: "أذونات مبنية على الأدوار.",
    },
  } as Record<'en' | 'ar', ValueTechContent>,
  en: {
    nav: [
      { name: "About", href: "#about" },
      { name: "Services", href: "#services" },
      { name: "Portfolio", href: "#portfolio" },
      { name: "Contact", href: "#contact" },
    ],
    hero: {
      headline: "Smart Software Solutions for a Smarter Future",
      subtext:
        "Spark Vision delivers innovative software, AI automation, and digital solutions for fast-growing businesses.",
      cta: "Get a Free Consultation",
    },
    video: {
      header: `Spark Vision: Cutting-Edge Technology Powering Innovation
                and Driving the Next Generation of Digital Transformation.`,
    },
    about: {
      title: "Who We Are",
      description:
        "Spark Vision is a forward-thinking IT company dedicated to crafting modern technology solutions. We specialize in custom software development, mobile apps, AI-powered automation, seamless cloud integration, and comprehensive digital transformation strategies to elevate your business.",
    },
    services: {
      title: "Our Services",
      subtitle:
        "We offer a wide range of services to help your business grow and succeed in the digital age.",
      items: [
        {
          title: "Custom Software Development",
          description:
            "Tailor-made software solutions designed to meet your unique business requirements.",
          icon: CodeXml,
        },
        {
          title: "Web & Mobile App Development",
          description:
            "Engaging and responsive web and mobile applications for a seamless user experience.",
          icon: Smartphone,
        },
        {
          title: "AI & Automation",
          description:
            "Leverage artificial intelligence to automate processes and drive efficiency.",
          icon: BrainCircuit,
        },
        {
          title: "Cloud Integration & DevOps",
          description:
            "Streamline your operations with our expert cloud and DevOps services.",
          icon: CloudCog,
        },
        {
          title: "IT Consulting",
          description:
            "Strategic guidance to help you navigate the complex world of technology.",
          icon: Briefcase,
        },
        {
          title: "Value Tech Platform",
          description:
            "A dedicated platform for report uploads and evaluation workflows.",
          icon: Zap,
          href: "/value-tech",
        },
      ],
    },
    whyChooseUs: {
      title: "Why Choose Spark Vision?",
      subtitle:
        "We are committed to delivering excellence and innovation in every project.",
      features: [
        {
          name: "High-Quality Development",
          description:
            "Our team of experts ensures top-notch quality in every line of code.",
          icon: Award,
        },
        {
          name: "Scalable Architecture",
          description:
            "We build robust and scalable solutions that grow with your business.",
          icon: Scaling,
        },
        {
          name: "Fast Delivery",
          description:
            "Agile methodologies for rapid development and timely delivery of your projects.",
          icon: Zap,
        },
        {
          name: "Dedicated Support Team",
          description:
            "Our support team is always here to help you with any issues or questions.",
          icon: Users2,
        },
        {
          name: "Advanced Cybersecurity",
          description:
            "We prioritize security to protect your data and applications from threats.",
          icon: ShieldCheck,
        },
      ],
    },
    portfolio: {
      title: "Our Work",
      subtitle: "A glimpse into some of the projects we are proud of.",
      projects: [
        {
          title: "Enterprise Resource Planning (ERP) System",
          description:
            "A comprehensive ERP system to streamline business operations for a manufacturing client.",
          imageId: "portfolio-1",
        },
        {
          title: "E-commerce Mobile App",
          description:
            "A feature-rich mobile app for a retail company, enhancing customer engagement.",
          imageId: "portfolio-2",
        },
        {
          title: "Cloud Migration for a FinTech Startup",
          description:
            "Successfully migrated a FinTech platform to a scalable and secure cloud infrastructure.",
          imageId: "portfolio-3",
        },
        {
          title: "AI-Powered Analytics Platform",
          description:
            "Developed an AI platform for data analysis and predictive modeling for a healthcare provider.",
          imageId: "portfolio-4",
        },
      ],
    },
    testimonials: {
      title: "What Our Clients Say",
      subtitle: "We are proud to have earned the trust of our amazing clients.",
      items: [
        {
          quote:
            "Spark Vision transformed our business with their innovative software solution. Their team was professional, and the delivery was on time.",
          name: "John Doe",
          company: "CEO, Innovate Inc.",
          imageId: "testimonial-1",
        },
        {
          quote:
            "The mobile app they developed for us has been a game-changer. User engagement is at an all-time high!",
          name: "Jane Smith",
          company: "Marketing Director, RetailCo",
          imageId: "testimonial-2",
        },
        {
          quote:
            "Their expertise in AI and automation has significantly improved our operational efficiency. Highly recommended.",
          name: "Sam Wilson",
          company: "COO, HealthFirst",
          imageId: "testimonial-3",
        },
      ],
    },
    contact: {
      title: "Get in Touch",
      subtitle:
        "Have a project in mind? We'd love to hear from you. Fill out the form below to get started.",
      form: {
        name: "Name",
        email: "Email",
        message: "Message",
        button: "Send Message",
        whatsappButton: "Contact Us",
        whatsappNumber: "",
      },
    },
    maintenance: {
      badge: "Scheduled Maintenance",
      title: "We Are Under Maintenance",
      description:
        "We are applying a fresh coat of polish to the site. Hang tight while we bring the new experience online.",
      note:
        "Need to reach us? Our contact channels stay open while we finish up.",
    },
    footer: {
      title: "Footer",
      description: "Smart software solutions for a smarter future.",
      copyright: "All rights reserved.",
      solutions: {
        title: "Solutions",
        items: [
          { name: "Custom Software", href: "#services" },
          { name: "Mobile Apps", href: "#services" },
          { name: "AI & Automation", href: "#services" },
          { name: "Cloud Integration", href: "#services" },
        ],
      },
      company: {
        title: "Company",
        items: [
          { name: "About Us", href: "#about" },
          { name: "Portfolio", href: "#portfolio" },
          { name: "Contact", href: "#contact" },
        ],
      },
      socials: [
        // {
        //   name: "Facebook",
        //   href: "#",
        //   icon: Facebook,
        // },
        {
          name: "Twitter",
          href: "https://x.com/sparkvisiosa",
          icon: Twitter,
        },
        {
          name: "LinkedIn",
          href: "https://www.linkedin.com/in/spark-vision-59b1b4387/",
          icon: Linkedin,
        },
        {
          name: "Snapchat",
          href: "https://www.snapchat.com/@sparkvisionsa",
          icon: MessageCircle,
        },
        {
          name: "TikTok",
          href: "https://www.tiktok.com/@sparkvisionsa",
          icon: TicketCheck,
        },
      ],
    },
  },
  ar: {
    nav: [
      { name: "من نحن", href: "#about" },
      { name: "خدماتنا", href: "#services" },
      { name: "أعمالنا", href: "#portfolio" },
      { name: "اتصل بنا", href: "#contact" },
    ],
    hero: {
      headline: "حلول برمجية ذكية لمستقبل أكثر ذكاءً",
      subtext:
        "سبارك فيجن تقدم برمجيات مبتكرة، وأتمتة بالذكاء الاصطناعي، وحلول رقمية للأعمال المتنامية.",
      cta: "احجز استشارة مجانية",
    },
    video: {
      header:
        "رؤية سبارك: التكنولوجيا المتطورة التي تدعم الابتكار وتقود الجيل القادم من التحول الرقمي.",
    },
    about: {
      title: "من نحن",
      description:
        "سبارك فيجن هي شركة تقنية معلومات ذات رؤية مستقبلية، متخصصة في ابتكار حلول تقنية حديثة. نحن متخصصون في تطوير البرمجيات المخصصة، وتطبيقات الجوال، والأتمتة المدعومة بالذكاء الاصطناعي، والتكامل السحابي السلس، واستراتيجيات التحول الرقمي الشاملة للارتقاء بأعمالك.",
    },
    services: {
      title: "خدماتنا",
      subtitle:
        "نقدم مجموعة واسعة من الخدمات لمساعدة أعمالك على النمو والنجاح في العصر الرقمي.",
      items: [
        {
          title: "تطوير البرمجيات المخصصة",
          description: "حلول برمجية مصممة خصيصًا لتلبية متطلبات عملك الفريدة.",
          icon: CodeXml,
        },
        {
          title: "تطوير تطبيقات الويب والجوال",
          description:
            "تطبيقات ويب وجوال جذابة وسريعة الاستجابة لتجربة مستخدم سلسة.",
          icon: Smartphone,
        },
        {
          title: "الذكاء الاصطناعي والأتمتة",
          description:
            "استفد من الذكاء الاصطناعي لأتمتة العمليات وزيادة الكفاءة.",
          icon: BrainCircuit,
        },
        {
          title: "التكامل السحابي و DevOps",
          description:
            "قم بتبسيط عملياتك من خلال خدماتنا السحابية و DevOps المتخصصة.",
          icon: CloudCog,
        },
        {
          title: "استشارات تقنية المعلومات",
          description:
            "إرشادات استراتيجية لمساعدتك في التنقل في عالم التكنولوجيا المعقد.",
          icon: Briefcase,
        },
        {
          title: "منصة Value Tech",
          description:
            "منصة مخصصة لرفع التقارير وإدارة مسارات التقييم بسرعة وأمان.",
          icon: Zap,
          href: "/value-tech",
        },
      ],
    },
    whyChooseUs: {
      title: "لماذا تختار سبارك فيجن؟",
      subtitle: "نحن ملتزمون بتقديم التميز والابتكار في كل مشروع.",
      features: [
        {
          name: "تطوير عالي الجودة",
          description:
            "يضمن فريق الخبراء لدينا جودة عالية في كل سطر من التعليمات البرمجية.",
          icon: Award,
        },
        {
          name: "هندسة قابلة للتطوير",
          description: "نبني حلولاً قوية وقابلة للتطوير تنمو مع عملك.",
          icon: Scaling,
        },
        {
          name: "تسليم سريع",
          description:
            "منهجيات Agile للتطوير السريع والتسليم في الوقت المحدد لمشاريعك.",
          icon: Zap,
        },
        {
          name: "فريق دعم مخصص",
          description:
            "فريق الدعم لدينا موجود دائمًا لمساعدتك في أي مشكلات أو أسئلة.",
          icon: Users2,
        },
        {
          name: "أمن سيبراني متقدم",
          description:
            "نحن نعطي الأولوية للأمن لحماية بياناتك وتطبيقاتك من التهديدات.",
          icon: ShieldCheck,
        },
      ],
    },
    portfolio: {
      title: "أعمالنا",
      subtitle: "لمحة عن بعض المشاريع التي نفخر بها.",
      projects: [
        {
          title: "نظام تخطيط موارد المؤسسات (ERP)",
          description:
            "نظام ERP شامل لتبسيط العمليات التجارية لعميل في قطاع التصنيع.",
          imageId: "portfolio-1",
        },
        {
          title: "تطبيق جوال للتجارة الإلكترونية",
          description:
            "تطبيق جوال غني بالميزات لشركة بيع بالتجزئة، يعزز تفاعل العملاء.",
          imageId: "portfolio-2",
        },
        {
          title: "ترحيل سحابي لشركة ناشئة في التكنولوجيا المالية",
          description:
            "تم ترحيل منصة تكنولوجيا مالية بنجاح إلى بنية تحتية سحابية آمنة وقابلة للتطوير.",
          imageId: "portfolio-3",
        },
        {
          title: "منصة تحليلات مدعومة بالذكاء الاصطناعي",
          description:
            "تطوير منصة ذكاء اصطناعي لتحليل البيانات والنمذجة التنبؤية لمزود رعاية صحية.",
          imageId: "portfolio-4",
        },
      ],
    },
    testimonials: {
      title: "ماذا يقول عملاؤنا",
      subtitle: "نحن فخورون بأننا كسبنا ثقة عملائنا الرائعين.",
      items: [
        {
          quote:
            "قامت سبارك فيجن بتحويل أعمالنا من خلال حلولها البرمجية المبتكرة. كان فريقهم محترفًا، وكان التسليم في الوقت المحدد.",
          name: "جون دو",
          company: "الرئيس التنفيذي، Innovate Inc.",
          imageId: "testimonial-1",
        },
        {
          quote:
            "كان تطبيق الجوال الذي طوروه لنا بمثابة تغيير جذري. تفاعل المستخدمين في أعلى مستوياته على الإطلاق!",
          name: "جين سميث",
          company: "مديرة التسويق، RetailCo",
          imageId: "testimonial-2",
        },
        {
          quote:
            "خبرتهم في الذكاء الاصطناعي والأتمتة حسنت بشكل كبير من كفاءتنا التشغيلية. موصى به للغاية.",
          name: "سام ويلسون",
          company: "مدير العمليات، HealthFirst",
          imageId: "testimonial-3",
        },
      ],
    },
    contact: {
      title: "تواصل معنا",
      subtitle:
        "هل لديك مشروع في ذهنك؟ نود أن نسمع منك. املأ النموذج أدناه للبدء.",
      form: {
        name: "الاسم",
        email: "البريد الإلكتروني",
        message: "الرسالة",
        button: "إرسال الرسالة",
        whatsappButton: "اتصل بنا",
        whatsappNumber: "01140943934",
      },
    },
    maintenance: {
      badge: "صيانة مجدولة",
      title: "نقوم بصيانة موقع سبارك فيجن",
      description:
        "نضيف بعض اللمسات الجديدة على الموقع. سنعود إليك قريبًا بتجربة محسنة.",
      note:
        "هل تحتاج للتواصل الآن؟ قنوات الاتصال بنا متاحة أثناء الصيانة.",
    },
    footer: {
      title: "تذييل",
      description: "حلول برمجية ذكية لمستقبل أكثر ذكاءً.",
      copyright: "جميع الحقوق محفوظة.",
      solutions: {
        title: "الحلول",
        items: [
          { name: "برمجيات مخصصة", href: "#services" },
          { name: "تطبيقات الجوال", href: "#services" },
          { name: "الذكاء الاصطناعي والأتمتة", href: "#services" },
          { name: "التكامل السحابي", href: "#services" },
        ],
      },
      company: {
        title: "الشركة",
        items: [
          { name: "من نحن", href: "#about" },
          { name: "أعمالنا", href: "#portfolio" },
          { name: "اتصل بنا", href: "#contact" },
        ],
      },
      socials: [
        {
          name: "تويتر",
          href: "https://x.com/sparkvisiosa",
          icon: Twitter,
        },
        {
          name: "لينكدان",
          href: "https://www.linkedin.com/in/spark-vision-59b1b4387/",
          icon: Linkedin,
        },
        {
          name: "سناب شات",
          href: "https://www.snapchat.com/@sparkvisionsa",
          icon: MessageCircle,
        },
        {
          name: "تيكتوك",
          href: "https://www.tiktok.com/@sparkvisionsa",
          icon: TicketCheck,
        },
      ],
    },
  },
};
