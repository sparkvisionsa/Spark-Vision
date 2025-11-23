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
} from "lucide-react";

export const content = {
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
      subtitle:
        "We are proud to have earned the trust of our amazing clients.",
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
      },
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
        {
          name: "Facebook",
          href: "#",
          icon: Facebook,
        },
        {
          name: "Twitter",
          href: "#",
          icon: Twitter,
        },
        {
          name: "LinkedIn",
          href: "#",
          icon: Linkedin,
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
          description:
            "حلول برمجية مصممة خصيصًا لتلبية متطلبات عملك الفريدة.",
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
          description: "إرشادات استراتيجية لمساعدتك في التنقل في عالم التكنولوجيا المعقد.",
          icon: Briefcase,
        },
      ],
    },
    whyChooseUs: {
      title: "لماذا تختار سبارك فيجن؟",
      subtitle: "نحن ملتزمون بتقديم التميز والابتكار في كل مشروع.",
      features: [
        {
          name: "تطوير عالي الجودة",
          description: "يضمن فريق الخبراء لدينا جودة عالية في كل سطر من التعليمات البرمجية.",
          icon: Award,
        },
        {
          name: "هندسة قابلة للتطوير",
          description: "نبني حلولاً قوية وقابلة للتطوير تنمو مع عملك.",
          icon: Scaling,
        },
        {
          name: "تسليم سريع",
          description: "منهجيات Agile للتطوير السريع والتسليم في الوقت المحدد لمشاريعك.",
          icon: Zap,
        },
        {
          name: "فريق دعم مخصص",
          description: "فريق الدعم لدينا موجود دائمًا لمساعدتك في أي مشكلات أو أسئلة.",
          icon: Users2,
        },
        {
          name: "أمن سيبراني متقدم",
          description: "نحن نعطي الأولوية للأمن لحماية بياناتك وتطبيقاتك من التهديدات.",
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
          description: "نظام ERP شامل لتبسيط العمليات التجارية لعميل في قطاع التصنيع.",
          imageId: "portfolio-1",
        },
        {
          title: "تطبيق جوال للتجارة الإلكترونية",
          description: "تطبيق جوال غني بالميزات لشركة بيع بالتجزئة، يعزز تفاعل العملاء.",
          imageId: "portfolio-2",
        },
        {
          title: "ترحيل سحابي لشركة ناشئة في التكنولوجيا المالية",
          description: "تم ترحيل منصة تكنولوجيا مالية بنجاح إلى بنية تحتية سحابية آمنة وقابلة للتطوير.",
          imageId: "portfolio-3",
        },
        {
          title: "منصة تحليلات مدعومة بالذكاء الاصطناعي",
          description: "تطوير منصة ذكاء اصطناعي لتحليل البيانات والنمذجة التنبؤية لمزود رعاية صحية.",
          imageId: "portfolio-4",
        },
      ],
    },
    testimonials: {
      title: "ماذا يقول عملاؤنا",
      subtitle: "نحن فخورون بأننا كسبنا ثقة عملائنا الرائعين.",
      items: [
        {
          quote: "قامت سبارك فيجن بتحويل أعمالنا من خلال حلولها البرمجية المبتكرة. كان فريقهم محترفًا، وكان التسليم في الوقت المحدد.",
          name: "جون دو",
          company: "الرئيس التنفيذي، Innovate Inc.",
          imageId: "testimonial-1",
        },
        {
          quote: "كان تطبيق الجوال الذي طوروه لنا بمثابة تغيير جذري. تفاعل المستخدمين في أعلى مستوياته على الإطلاق!",
          name: "جين سميث",
          company: "مديرة التسويق، RetailCo",
          imageId: "testimonial-2",
        },
        {
          quote: "خبرتهم في الذكاء الاصطناعي والأتمتة حسنت بشكل كبير من كفاءتنا التشغيلية. موصى به للغاية.",
          name: "سام ويلسون",
          company: "مدير العمليات، HealthFirst",
          imageId: "testimonial-3",
        },
      ],
    },
    contact: {
      title: "تواصل معنا",
      subtitle: "هل لديك مشروع في ذهنك؟ نود أن نسمع منك. املأ النموذج أدناه للبدء.",
      form: {
        name: "الاسم",
        email: "البريد الإلكتروني",
        message: "الرسالة",
        button: "إرسال الرسالة",
      },
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
          name: "فيسبوك",
          href: "#",
          icon: Facebook,
        },
        {
          name: "تويتر",
          href: "#",
          icon: Twitter,
        },
        {
          name: "لينكد إن",
          href: "#",
          icon: Linkedin,
        },
      ],
    },
  },
};
