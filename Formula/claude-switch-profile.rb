require "language/node"

class ClaudeSwitchProfile < Formula
  desc "CLI tool for managing multiple Claude Code profiles"
  homepage "https://github.com/ThanhThi2895/claude-switch-profile"
  url "https://registry.npmjs.org/claude-switch-profile/-/claude-switch-profile-1.4.23.tgz"
  sha256 "c342b8738d4e921d85b5f168ae6f23e494573a205cc8334daaa37f3f8858820f"
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
