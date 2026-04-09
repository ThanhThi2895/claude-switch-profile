require "language/node"

class ClaudeSwitchProfile < Formula
  desc "CLI tool for managing multiple Claude Code profiles"
  homepage "https://github.com/ThanhThi2895/claude-switch-profile"
  url "https://registry.npmjs.org/claude-switch-profile/-/claude-switch-profile-1.4.20.tgz"
  sha256 "5cb22677386f5220f92ccfe714e968e8121e27943daed2e816f6b1128cf8aba9"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "Usage: csp", shell_output("#{bin}/csp --help")
  end
end
