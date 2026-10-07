export interface PhoneCountryRule {
  min: number
  max: number
  stripLeadingZero: boolean
}

export interface PhoneCountryOption extends PhoneCountryRule {
  code: `+${string}`
  name: string
  flag: string
}

export const PHONE_COUNTRIES = [
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh', min: 10, max: 10, stripLeadingZero: true },
  { code: '+91', flag: '🇮🇳', name: 'India', min: 10, max: 10, stripLeadingZero: false },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan', min: 10, max: 10, stripLeadingZero: true },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka', min: 9, max: 10, stripLeadingZero: true },
  { code: '+977', flag: '🇳🇵', name: 'Nepal', min: 9, max: 10, stripLeadingZero: true },
  { code: '+95', flag: '🇲🇲', name: 'Myanmar', min: 8, max: 10, stripLeadingZero: true },
  { code: '+1', flag: '🇺🇸', name: 'United States', min: 10, max: 10, stripLeadingZero: false },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom', min: 10, max: 10, stripLeadingZero: true },
  { code: '+61', flag: '🇦🇺', name: 'Australia', min: 9, max: 9, stripLeadingZero: true },
  { code: '+971', flag: '🇦🇪', name: 'United Arab Emirates', min: 9, max: 9, stripLeadingZero: false },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia', min: 9, max: 9, stripLeadingZero: false },
  { code: '+65', flag: '🇸🇬', name: 'Singapore', min: 8, max: 8, stripLeadingZero: false },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia', min: 9, max: 11, stripLeadingZero: true },
  { code: '+66', flag: '🇹🇭', name: 'Thailand', min: 9, max: 10, stripLeadingZero: true },
  { code: '+81', flag: '🇯🇵', name: 'Japan', min: 10, max: 11, stripLeadingZero: true },
  { code: '+82', flag: '🇰🇷', name: 'South Korea', min: 9, max: 11, stripLeadingZero: true },
  { code: '+86', flag: '🇨🇳', name: 'China', min: 11, max: 11, stripLeadingZero: true },
  { code: '+49', flag: '🇩🇪', name: 'Germany', min: 10, max: 12, stripLeadingZero: true },
  { code: '+33', flag: '🇫🇷', name: 'France', min: 9, max: 10, stripLeadingZero: true },
  { code: '+7', flag: '🇷🇺', name: 'Russia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+20', flag: '🇪🇬', name: 'Egypt', min: 4, max: 15, stripLeadingZero: false },
  { code: '+27', flag: '🇿🇦', name: 'South Africa', min: 4, max: 15, stripLeadingZero: false },
  { code: '+30', flag: '🇬🇷', name: 'Greece', min: 4, max: 15, stripLeadingZero: false },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands', min: 4, max: 15, stripLeadingZero: false },
  { code: '+32', flag: '🇧🇪', name: 'Belgium', min: 4, max: 15, stripLeadingZero: false },
  { code: '+34', flag: '🇪🇸', name: 'Spain', min: 4, max: 15, stripLeadingZero: false },
  { code: '+36', flag: '🇭🇺', name: 'Hungary', min: 4, max: 15, stripLeadingZero: false },
  { code: '+39', flag: '🇮🇹', name: 'Italy', min: 4, max: 15, stripLeadingZero: false },
  { code: '+40', flag: '🇷🇴', name: 'Romania', min: 4, max: 15, stripLeadingZero: false },
  { code: '+41', flag: '🇨🇭', name: 'Switzerland', min: 4, max: 15, stripLeadingZero: false },
  { code: '+43', flag: '🇦🇹', name: 'Austria', min: 4, max: 15, stripLeadingZero: false },
  { code: '+45', flag: '🇩🇰', name: 'Denmark', min: 4, max: 15, stripLeadingZero: false },
  { code: '+46', flag: '🇸🇪', name: 'Sweden', min: 4, max: 15, stripLeadingZero: false },
  { code: '+47', flag: '🇳🇴', name: 'Norway', min: 4, max: 15, stripLeadingZero: false },
  { code: '+48', flag: '🇵🇱', name: 'Poland', min: 4, max: 15, stripLeadingZero: false },
  { code: '+51', flag: '🇵🇪', name: 'Peru', min: 4, max: 15, stripLeadingZero: false },
  { code: '+52', flag: '🇲🇽', name: 'Mexico', min: 4, max: 15, stripLeadingZero: false },
  { code: '+53', flag: '🇨🇺', name: 'Cuba', min: 4, max: 15, stripLeadingZero: false },
  { code: '+54', flag: '🇦🇷', name: 'Argentina', min: 4, max: 15, stripLeadingZero: false },
  { code: '+55', flag: '🇧🇷', name: 'Brazil', min: 4, max: 15, stripLeadingZero: false },
  { code: '+56', flag: '🇨🇱', name: 'Chile', min: 4, max: 15, stripLeadingZero: false },
  { code: '+57', flag: '🇨🇴', name: 'Colombia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela', min: 4, max: 15, stripLeadingZero: false },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+63', flag: '🇵🇭', name: 'Philippines', min: 4, max: 15, stripLeadingZero: false },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand', min: 4, max: 15, stripLeadingZero: false },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam', min: 4, max: 15, stripLeadingZero: false },
  { code: '+90', flag: '🇹🇷', name: 'Turkey', min: 4, max: 15, stripLeadingZero: false },
  { code: '+93', flag: '🇦🇫', name: 'Afghanistan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+98', flag: '🇮🇷', name: 'Iran', min: 4, max: 15, stripLeadingZero: false },
  { code: '+211', flag: '🇸🇸', name: 'South Sudan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+212', flag: '🇲🇦', name: 'Morocco', min: 4, max: 15, stripLeadingZero: false },
  { code: '+213', flag: '🇩🇿', name: 'Algeria', min: 4, max: 15, stripLeadingZero: false },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+218', flag: '🇱🇾', name: 'Libya', min: 4, max: 15, stripLeadingZero: false },
  { code: '+220', flag: '🇬🇲', name: 'Gambia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+221', flag: '🇸🇳', name: 'Senegal', min: 4, max: 15, stripLeadingZero: false },
  { code: '+222', flag: '🇲🇷', name: 'Mauritania', min: 4, max: 15, stripLeadingZero: false },
  { code: '+223', flag: '🇲🇱', name: 'Mali', min: 4, max: 15, stripLeadingZero: false },
  { code: '+224', flag: '🇬🇳', name: 'Guinea', min: 4, max: 15, stripLeadingZero: false },
  { code: '+225', flag: '🇨🇮', name: 'Ivory Coast', min: 4, max: 15, stripLeadingZero: false },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso', min: 4, max: 15, stripLeadingZero: false },
  { code: '+227', flag: '🇳🇪', name: 'Niger', min: 4, max: 15, stripLeadingZero: false },
  { code: '+228', flag: '🇹🇬', name: 'Togo', min: 4, max: 15, stripLeadingZero: false },
  { code: '+229', flag: '🇧🇯', name: 'Benin', min: 4, max: 15, stripLeadingZero: false },
  { code: '+230', flag: '🇲🇺', name: 'Mauritius', min: 4, max: 15, stripLeadingZero: false },
  { code: '+231', flag: '🇱🇷', name: 'Liberia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+232', flag: '🇸🇱', name: 'Sierra Leone', min: 4, max: 15, stripLeadingZero: false },
  { code: '+233', flag: '🇬🇭', name: 'Ghana', min: 4, max: 15, stripLeadingZero: false },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria', min: 4, max: 15, stripLeadingZero: false },
  { code: '+235', flag: '🇹🇩', name: 'Chad', min: 4, max: 15, stripLeadingZero: false },
  { code: '+236', flag: '🇨🇫', name: 'Central African Republic', min: 4, max: 15, stripLeadingZero: false },
  { code: '+237', flag: '🇨🇲', name: 'Cameroon', min: 4, max: 15, stripLeadingZero: false },
  { code: '+238', flag: '🇨🇻', name: 'Cape Verde', min: 4, max: 15, stripLeadingZero: false },
  { code: '+239', flag: '🇸🇹', name: 'São Tomé and Príncipe', min: 4, max: 15, stripLeadingZero: false },
  { code: '+240', flag: '🇬🇶', name: 'Equatorial Guinea', min: 4, max: 15, stripLeadingZero: false },
  { code: '+241', flag: '🇬🇦', name: 'Gabon', min: 4, max: 15, stripLeadingZero: false },
  { code: '+242', flag: '🇨🇬', name: 'Republic of the Congo', min: 4, max: 15, stripLeadingZero: false },
  { code: '+243', flag: '🇨🇩', name: 'DR Congo', min: 4, max: 15, stripLeadingZero: false },
  { code: '+244', flag: '🇦🇴', name: 'Angola', min: 4, max: 15, stripLeadingZero: false },
  { code: '+245', flag: '🇬🇼', name: 'Guinea-Bissau', min: 4, max: 15, stripLeadingZero: false },
  { code: '+246', flag: '🇮🇴', name: 'British Indian Ocean Territory', min: 4, max: 15, stripLeadingZero: false },
  { code: '+248', flag: '🇸🇨', name: 'Seychelles', min: 4, max: 15, stripLeadingZero: false },
  { code: '+249', flag: '🇸🇩', name: 'Sudan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda', min: 4, max: 15, stripLeadingZero: false },
  { code: '+251', flag: '🇪🇹', name: 'Ethiopia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+252', flag: '🇸🇴', name: 'Somalia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+253', flag: '🇩🇯', name: 'Djibouti', min: 4, max: 15, stripLeadingZero: false },
  { code: '+254', flag: '🇰🇪', name: 'Kenya', min: 4, max: 15, stripLeadingZero: false },
  { code: '+255', flag: '🇹🇿', name: 'Tanzania', min: 4, max: 15, stripLeadingZero: false },
  { code: '+256', flag: '🇺🇬', name: 'Uganda', min: 4, max: 15, stripLeadingZero: false },
  { code: '+257', flag: '🇧🇮', name: 'Burundi', min: 4, max: 15, stripLeadingZero: false },
  { code: '+258', flag: '🇲🇿', name: 'Mozambique', min: 4, max: 15, stripLeadingZero: false },
  { code: '+260', flag: '🇿🇲', name: 'Zambia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+261', flag: '🇲🇬', name: 'Madagascar', min: 4, max: 15, stripLeadingZero: false },
  { code: '+262', flag: '🇷🇪', name: 'Réunion', min: 4, max: 15, stripLeadingZero: false },
  { code: '+263', flag: '🇿🇼', name: 'Zimbabwe', min: 4, max: 15, stripLeadingZero: false },
  { code: '+264', flag: '🇳🇦', name: 'Namibia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+265', flag: '🇲🇼', name: 'Malawi', min: 4, max: 15, stripLeadingZero: false },
  { code: '+266', flag: '🇱🇸', name: 'Lesotho', min: 4, max: 15, stripLeadingZero: false },
  { code: '+267', flag: '🇧🇼', name: 'Botswana', min: 4, max: 15, stripLeadingZero: false },
  { code: '+268', flag: '🇸🇿', name: 'Eswatini', min: 4, max: 15, stripLeadingZero: false },
  { code: '+269', flag: '🇰🇲', name: 'Comoros', min: 4, max: 15, stripLeadingZero: false },
  { code: '+290', flag: '🇸🇭', name: 'Saint Helena', min: 4, max: 15, stripLeadingZero: false },
  { code: '+291', flag: '🇪🇷', name: 'Eritrea', min: 4, max: 15, stripLeadingZero: false },
  { code: '+297', flag: '🇦🇼', name: 'Aruba', min: 4, max: 15, stripLeadingZero: false },
  { code: '+298', flag: '🇫🇴', name: 'Faroe Islands', min: 4, max: 15, stripLeadingZero: false },
  { code: '+299', flag: '🇬🇱', name: 'Greenland', min: 4, max: 15, stripLeadingZero: false },
  { code: '+350', flag: '🇬🇮', name: 'Gibraltar', min: 4, max: 15, stripLeadingZero: false },
  { code: '+351', flag: '🇵🇹', name: 'Portugal', min: 4, max: 15, stripLeadingZero: false },
  { code: '+352', flag: '🇱🇺', name: 'Luxembourg', min: 4, max: 15, stripLeadingZero: false },
  { code: '+353', flag: '🇮🇪', name: 'Ireland', min: 4, max: 15, stripLeadingZero: false },
  { code: '+354', flag: '🇮🇸', name: 'Iceland', min: 4, max: 15, stripLeadingZero: false },
  { code: '+355', flag: '🇦🇱', name: 'Albania', min: 4, max: 15, stripLeadingZero: false },
  { code: '+356', flag: '🇲🇹', name: 'Malta', min: 4, max: 15, stripLeadingZero: false },
  { code: '+357', flag: '🇨🇾', name: 'Cyprus', min: 4, max: 15, stripLeadingZero: false },
  { code: '+358', flag: '🇫🇮', name: 'Finland', min: 4, max: 15, stripLeadingZero: false },
  { code: '+359', flag: '🇧🇬', name: 'Bulgaria', min: 4, max: 15, stripLeadingZero: false },
  { code: '+370', flag: '🇱🇹', name: 'Lithuania', min: 4, max: 15, stripLeadingZero: false },
  { code: '+371', flag: '🇱🇻', name: 'Latvia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+372', flag: '🇪🇪', name: 'Estonia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+373', flag: '🇲🇩', name: 'Moldova', min: 4, max: 15, stripLeadingZero: false },
  { code: '+374', flag: '🇦🇲', name: 'Armenia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+375', flag: '🇧🇾', name: 'Belarus', min: 4, max: 15, stripLeadingZero: false },
  { code: '+376', flag: '🇦🇩', name: 'Andorra', min: 4, max: 15, stripLeadingZero: false },
  { code: '+377', flag: '🇲🇨', name: 'Monaco', min: 4, max: 15, stripLeadingZero: false },
  { code: '+378', flag: '🇸🇲', name: 'San Marino', min: 4, max: 15, stripLeadingZero: false },
  { code: '+379', flag: '🇻🇦', name: 'Vatican City', min: 4, max: 15, stripLeadingZero: false },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine', min: 4, max: 15, stripLeadingZero: false },
  { code: '+381', flag: '🇷🇸', name: 'Serbia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+382', flag: '🇲🇪', name: 'Montenegro', min: 4, max: 15, stripLeadingZero: false },
  { code: '+383', flag: '🇽🇰', name: 'Kosovo', min: 4, max: 15, stripLeadingZero: false },
  { code: '+385', flag: '🇭🇷', name: 'Croatia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+386', flag: '🇸🇮', name: 'Slovenia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+387', flag: '🇧🇦', name: 'Bosnia and Herzegovina', min: 4, max: 15, stripLeadingZero: false },
  { code: '+389', flag: '🇲🇰', name: 'North Macedonia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+420', flag: '🇨🇿', name: 'Czech Republic', min: 4, max: 15, stripLeadingZero: false },
  { code: '+421', flag: '🇸🇰', name: 'Slovakia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+423', flag: '🇱🇮', name: 'Liechtenstein', min: 4, max: 15, stripLeadingZero: false },
  { code: '+500', flag: '🇫🇰', name: 'Falkland Islands', min: 4, max: 15, stripLeadingZero: false },
  { code: '+501', flag: '🇧🇿', name: 'Belize', min: 4, max: 15, stripLeadingZero: false },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala', min: 4, max: 15, stripLeadingZero: false },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador', min: 4, max: 15, stripLeadingZero: false },
  { code: '+504', flag: '🇭🇳', name: 'Honduras', min: 4, max: 15, stripLeadingZero: false },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua', min: 4, max: 15, stripLeadingZero: false },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica', min: 4, max: 15, stripLeadingZero: false },
  { code: '+507', flag: '🇵🇦', name: 'Panama', min: 4, max: 15, stripLeadingZero: false },
  { code: '+508', flag: '🇵🇲', name: 'Saint Pierre and Miquelon', min: 4, max: 15, stripLeadingZero: false },
  { code: '+509', flag: '🇭🇹', name: 'Haiti', min: 4, max: 15, stripLeadingZero: false },
  { code: '+590', flag: '🇬🇵', name: 'Guadeloupe', min: 4, max: 15, stripLeadingZero: false },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+592', flag: '🇬🇾', name: 'Guyana', min: 4, max: 15, stripLeadingZero: false },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador', min: 4, max: 15, stripLeadingZero: false },
  { code: '+594', flag: '🇬🇫', name: 'French Guiana', min: 4, max: 15, stripLeadingZero: false },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay', min: 4, max: 15, stripLeadingZero: false },
  { code: '+596', flag: '🇲🇶', name: 'Martinique', min: 4, max: 15, stripLeadingZero: false },
  { code: '+597', flag: '🇸🇷', name: 'Suriname', min: 4, max: 15, stripLeadingZero: false },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay', min: 4, max: 15, stripLeadingZero: false },
  { code: '+599', flag: '🇨🇼', name: 'Curaçao', min: 4, max: 15, stripLeadingZero: false },
  { code: '+670', flag: '🇹🇱', name: 'East Timor', min: 4, max: 15, stripLeadingZero: false },
  { code: '+672', flag: '🇳🇫', name: 'Norfolk Island', min: 4, max: 15, stripLeadingZero: false },
  { code: '+673', flag: '🇧🇳', name: 'Brunei', min: 4, max: 15, stripLeadingZero: false },
  { code: '+674', flag: '🇳🇷', name: 'Nauru', min: 4, max: 15, stripLeadingZero: false },
  { code: '+675', flag: '🇵🇬', name: 'Papua New Guinea', min: 4, max: 15, stripLeadingZero: false },
  { code: '+676', flag: '🇹🇴', name: 'Tonga', min: 4, max: 15, stripLeadingZero: false },
  { code: '+677', flag: '🇸🇧', name: 'Solomon Islands', min: 4, max: 15, stripLeadingZero: false },
  { code: '+678', flag: '🇻🇺', name: 'Vanuatu', min: 4, max: 15, stripLeadingZero: false },
  { code: '+679', flag: '🇫🇯', name: 'Fiji', min: 4, max: 15, stripLeadingZero: false },
  { code: '+680', flag: '🇵🇼', name: 'Palau', min: 4, max: 15, stripLeadingZero: false },
  { code: '+681', flag: '🇼🇫', name: 'Wallis and Futuna', min: 4, max: 15, stripLeadingZero: false },
  { code: '+682', flag: '🇨🇰', name: 'Cook Islands', min: 4, max: 15, stripLeadingZero: false },
  { code: '+683', flag: '🇳🇺', name: 'Niue', min: 4, max: 15, stripLeadingZero: false },
  { code: '+685', flag: '🇼🇸', name: 'Samoa', min: 4, max: 15, stripLeadingZero: false },
  { code: '+686', flag: '🇰🇮', name: 'Kiribati', min: 4, max: 15, stripLeadingZero: false },
  { code: '+687', flag: '🇳🇨', name: 'New Caledonia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+688', flag: '🇹🇻', name: 'Tuvalu', min: 4, max: 15, stripLeadingZero: false },
  { code: '+689', flag: '🇵🇫', name: 'French Polynesia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+690', flag: '🇹🇰', name: 'Tokelau', min: 4, max: 15, stripLeadingZero: false },
  { code: '+691', flag: '🇫🇲', name: 'Micronesia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+692', flag: '🇲🇭', name: 'Marshall Islands', min: 4, max: 15, stripLeadingZero: false },
  { code: '+850', flag: '🇰🇵', name: 'North Korea', min: 4, max: 15, stripLeadingZero: false },
  { code: '+852', flag: '🇭🇰', name: 'Hong Kong', min: 4, max: 15, stripLeadingZero: false },
  { code: '+853', flag: '🇲🇴', name: 'Macau', min: 4, max: 15, stripLeadingZero: false },
  { code: '+855', flag: '🇰🇭', name: 'Cambodia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+856', flag: '🇱🇦', name: 'Laos', min: 4, max: 15, stripLeadingZero: false },
  { code: '+886', flag: '🇹🇼', name: 'Taiwan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+960', flag: '🇲🇻', name: 'Maldives', min: 4, max: 15, stripLeadingZero: false },
  { code: '+961', flag: '🇱🇧', name: 'Lebanon', min: 4, max: 15, stripLeadingZero: false },
  { code: '+962', flag: '🇯🇴', name: 'Jordan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+963', flag: '🇸🇾', name: 'Syria', min: 4, max: 15, stripLeadingZero: false },
  { code: '+964', flag: '🇮🇶', name: 'Iraq', min: 4, max: 15, stripLeadingZero: false },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait', min: 4, max: 15, stripLeadingZero: false },
  { code: '+967', flag: '🇾🇪', name: 'Yemen', min: 4, max: 15, stripLeadingZero: false },
  { code: '+968', flag: '🇴🇲', name: 'Oman', min: 4, max: 15, stripLeadingZero: false },
  { code: '+970', flag: '🇵🇸', name: 'Palestine', min: 4, max: 15, stripLeadingZero: false },
  { code: '+972', flag: '🇮🇱', name: 'Israel', min: 4, max: 15, stripLeadingZero: false },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain', min: 4, max: 15, stripLeadingZero: false },
  { code: '+974', flag: '🇶🇦', name: 'Qatar', min: 4, max: 15, stripLeadingZero: false },
  { code: '+975', flag: '🇧🇹', name: 'Bhutan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+976', flag: '🇲🇳', name: 'Mongolia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+992', flag: '🇹🇯', name: 'Tajikistan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+993', flag: '🇹🇲', name: 'Turkmenistan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+994', flag: '🇦🇿', name: 'Azerbaijan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+995', flag: '🇬🇪', name: 'Georgia', min: 4, max: 15, stripLeadingZero: false },
  { code: '+996', flag: '🇰🇬', name: 'Kyrgyzstan', min: 4, max: 15, stripLeadingZero: false },
  { code: '+998', flag: '🇺🇿', name: 'Uzbekistan', min: 4, max: 15, stripLeadingZero: false },
] as const satisfies readonly PhoneCountryOption[]

export type PhoneCountryCode = (typeof PHONE_COUNTRIES)[number]['code']

export const DEFAULT_PHONE_COUNTRY_CODE: PhoneCountryCode = '+880'

export const countryRules: Record<PhoneCountryCode, PhoneCountryRule> = PHONE_COUNTRIES.reduce(
  (acc, country) => {
    acc[country.code] = {
      min: country.min,
      max: country.max,
      stripLeadingZero: country.stripLeadingZero,
    }
    return acc
  },
  {} as Record<PhoneCountryCode, PhoneCountryRule>
)

export const PHONE_RULES = countryRules

export const PHONE_INPUT_ALLOWED_CHARACTERS = /[^0-9+\s()-]/g

export const sanitizePhoneTypingInput = (value: string): string =>
  value.replace(PHONE_INPUT_ALLOWED_CHARACTERS, '')

export const extractPhoneDigits = (value: string): string => value.replace(/\D/g, '')

const getPhoneRule = (countryCode: string): PhoneCountryRule | null =>
  countryRules[countryCode as PhoneCountryCode] ?? null

const stripManualCountryPrefix = (digits: string, countryDigits: string): string => {
  if (!countryDigits) return digits

  if (digits.startsWith(`00${countryDigits}`)) {
    return digits.slice(2 + countryDigits.length)
  }

  if (digits.startsWith(countryDigits)) {
    return digits.slice(countryDigits.length)
  }

  return digits
}

const stripNationalTrunkPrefix = (digits: string): string =>
  digits.startsWith('0') ? digits.slice(1) : digits

export const normalizePhone = (phone: string, countryCode: string): string => {
  let digits = extractPhoneDigits(phone)
  const countryDigits = extractPhoneDigits(countryCode)
  const rule = getPhoneRule(countryCode)

  digits = stripManualCountryPrefix(digits, countryDigits)

  if (rule?.stripLeadingZero) {
    digits = stripNationalTrunkPrefix(digits)
  }

  return digits
}

export const buildInternationalPhone = (phone: string, countryCode: string): string => {
  const normalized = normalizePhone(phone, countryCode)
  const countryDigits = extractPhoneDigits(countryCode)

  if (!normalized || !countryDigits) return ''
  return `+${countryDigits}${normalized}`
}

export const validatePhone = (phone: string, countryCode: string): string | null => {
  const rule = getPhoneRule(countryCode)
  if (!rule) return null

  const raw = String(phone ?? '').trim()
  if (!raw) return null

  const normalized = normalizePhone(raw, countryCode)
  if (!normalized) return `Enter a valid phone number for ${countryCode}.`

  const range = rule.min === rule.max ? `${rule.min}` : `${rule.min}-${rule.max}`

  if (normalized.length < rule.min) {
    return `Phone too short for ${countryCode}: need ${range} digits, got ${normalized.length}.`
  }

  if (normalized.length > rule.max) {
    return `Phone too long for ${countryCode}: need ${range} digits, got ${normalized.length}.`
  }

  return null
}

export const splitPhoneEntries = (value?: string | null): string[] =>
  (value || '')
    .split(/[;,\n]+/)
    .map(part => part.trim())
    .filter(Boolean)

export const normalizeStoredPhones = (value: string | undefined | null, countryCode: string): string[] =>
  splitPhoneEntries(value)
    .map(entry => buildInternationalPhone(entry, countryCode))
    .filter(Boolean)

export const phoneEntryMatches = (left: string, right: string, countryCode: string): boolean =>
  buildInternationalPhone(left, countryCode) === buildInternationalPhone(right, countryCode)

export const hasMatchingPhoneEntry = (
  existingPhone: string | undefined | null,
  nextPhone: string,
  countryCode: string
): boolean => splitPhoneEntries(existingPhone).some(entry => phoneEntryMatches(entry, nextPhone, countryCode))

export const mergePhoneEntries = (
  existingPhone: string | undefined | null,
  nextPhone: string,
  countryCode: string
): string => {
  const normalizedNextPhone = buildInternationalPhone(nextPhone, countryCode)
  if (!normalizedNextPhone) return (existingPhone || '').trim()

  const existingEntries = splitPhoneEntries(existingPhone)
  if (hasMatchingPhoneEntry(existingPhone, nextPhone, countryCode)) {
    return existingEntries.join(', ')
  }

  return [...existingEntries, normalizedNextPhone].filter(Boolean).join(', ')
}

export const formatPhoneCountryLabel = (country: PhoneCountryOption): string =>
  `${country.flag} ${country.name} (${country.code})`

export const getPhoneSearchVariants = (value: string, countryCode?: string): string[] => {
  const raw = String(value ?? '').trim()
  if (!raw) return []

  const variants = new Set<string>()
  const digits = extractPhoneDigits(raw)

  if (raw) variants.add(raw)
  if (digits) variants.add(digits)

  const countryCodes = countryCode
    ? [countryCode]
    : PHONE_COUNTRIES.map(country => country.code)

  for (const code of countryCodes) {
    const normalized = normalizePhone(raw, code)
    if (normalized) {
      variants.add(normalized)
      const intl = buildInternationalPhone(raw, code)
      if (intl) variants.add(extractPhoneDigits(intl))
    }
  }

  return [...variants].filter(Boolean)
}

export const matchesPhoneSearch = (phone: string, query: string, countryCode?: string): boolean => {
  const queryVariants = getPhoneSearchVariants(query, countryCode)
  if (queryVariants.length === 0) return true

  const phoneVariants = getPhoneSearchVariants(phone, countryCode)
  return phoneVariants.some(phoneVariant =>
    queryVariants.some(queryVariant =>
      phoneVariant.includes(queryVariant) || queryVariant.includes(phoneVariant)
    )
  )
}