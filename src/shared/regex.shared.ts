class CommonRegExp {
  public static readonly NAME_REGEXP = /^[A-Za-z]+[A-Za-z\s]{0,99}$/;
  public static readonly EMAIL_REGEXP = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  public static readonly STRONG_PASSWORD_MIN = /^.{6,100}$/;
}

export { CommonRegExp };
